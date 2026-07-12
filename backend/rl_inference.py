"""
Lightweight RL Policy Inference — No Ray/RLlib Required.
Loads trained PPO/MAPPO neural network weights directly from the RLlib checkpoint
pickle files and runs forward passes with pure PyTorch.

Supports two architectures:
  - PPO v1 (legacy): Input(20) → Linear(256) → ReLU → Linear(256) → ReLU → Linear(9)
  - MAPPO v2 (current): Input(20) → Linear(256) → ReLU → Linear(256) → ReLU → Linear(128) → ReLU → Linear(9)

The loader auto-detects which architecture the checkpoint uses.
"""
import os
import pickle
import torch
import torch.nn as nn
import numpy as np
from pathlib import Path


class PolicyNetwork(nn.Module):
    """
    Reconstructs the RLlib PPO/MAPPO Actor network from extracted weights.
    Architecture is auto-detected based on the checkpoint's weight shapes.
    """
    def __init__(self, input_dim: int = 20, hidden_layers: list = None):
        super().__init__()
        if hidden_layers is None:
            hidden_layers = [256, 256]

        layers = []
        in_dim = input_dim
        for h in hidden_layers:
            layers.append(nn.Linear(in_dim, h))
            layers.append(nn.ReLU())
            in_dim = h

        self.encoder = nn.Sequential(*layers)
        self.action_head = nn.Linear(in_dim, 9)

    def forward(self, obs: torch.Tensor) -> int:
        """Takes an observation tensor, returns the best action (0-8)."""
        with torch.no_grad():
            encoded = self.encoder(obs)
            logits = self.action_head(encoded)
            action = torch.argmax(logits, dim=-1).item()
        return int(action)


def _detect_architecture(state_dict: dict) -> tuple:
    """
    Auto-detects input_dim and hidden layer sizes from the RLlib weight dict.
    The first layer weight shape is [out_features, in_features].
    """
    first_key = "encoder.actor_encoder.net.mlp.0.weight"
    if first_key not in state_dict:
        return 20, [256, 256]  # PPO v1 fallback

    input_dim = state_dict[first_key].shape[1]
    hidden_layers = []
    i = 0
    while True:
        key = f"encoder.actor_encoder.net.mlp.{i}.weight"
        if key not in state_dict:
            break
        hidden_layers.append(state_dict[key].shape[0])
        i += 2  # Skip ReLU
    return input_dim, hidden_layers


def load_policy_from_checkpoint(policy_name: str, checkpoint_dir: str) -> PolicyNetwork:
    """
    Loads a specific policy (scout_policy, spotter_policy, rescuer_policy)
    from the RLlib checkpoint directory using pure pickle + PyTorch.
    Auto-detects PPO v1 vs MAPPO v2 architecture.
    """
    state_path = os.path.join(
        checkpoint_dir, "learner_group", "learner",
        "rl_module", policy_name, "module_state.pkl"
    )

    if not os.path.exists(state_path):
        raise FileNotFoundError(f"Policy weights not found at {state_path}")

    # SECURITY NOTE: pickle.load can execute arbitrary code. These checkpoint files are
    # our own locally-trained RL models (never user-supplied), so this is safe in context.
    # If this system ever accepts user-uploaded model files, switch to safetensors or ONNX.
    with open(state_path, "rb") as f:
        state_dict = pickle.load(f)

    # Auto-detect input_dim and architecture from checkpoint weights
    input_dim, hidden_layers = _detect_architecture(state_dict)
    net = PolicyNetwork(input_dim=input_dim, hidden_layers=hidden_layers)

    # Build weight mapping dynamically based on detected architecture
    mapping = {}
    layer_idx = 0   # RLlib MLP index (0, 2, 4 — skips ReLU)
    net_idx   = 0   # nn.Sequential index (0, 2, 4 — skips ReLU)

    while True:
        weight_key = f"encoder.actor_encoder.net.mlp.{layer_idx}.weight"
        bias_key   = f"encoder.actor_encoder.net.mlp.{layer_idx}.bias"
        if weight_key not in state_dict:
            break
        mapping[f"encoder.{net_idx}.weight"] = torch.tensor(state_dict[weight_key])
        mapping[f"encoder.{net_idx}.bias"]   = torch.tensor(state_dict[bias_key])
        net_idx   += 2
        layer_idx += 2

    # Action head
    mapping["action_head.weight"] = torch.tensor(state_dict["pi.net.mlp.0.weight"])
    mapping["action_head.bias"]   = torch.tensor(state_dict["pi.net.mlp.0.bias"])

    net.load_state_dict(mapping)
    net.eval()
    return net


def is_cuda_compatible() -> bool:
    """
    Checks if CUDA is available AND compatible with the precompiled PyTorch binary.
    Newer architectures (like RTX 50-series with sm_120) are not natively supported
    by older PyTorch binaries and will trigger a 90s freeze/probe hang or throw errors.
    """
    if not torch.cuda.is_available():
        return False
    try:
        major, minor = torch.cuda.get_device_capability(0)
        # Precompiled PyTorch packages currently support up to Hopper/Lovelace (sm_90)
        if major > 9:
            print(f"[Poseidon GPU Probe] CUDA capability {major}.{minor} is higher than supported by this PyTorch binary (max sm_90). Forcing CPU fallback to prevent hangs.")
            return False
        return True
    except:
        return False


class SwarmInference:
    """
    Production-grade multi-agent RL inference engine.
    Loads all trained policy networks (scout, spotter, rescuer) and provides
    real-time action decisions. Supports PPO v1 and MAPPO v2 checkpoints.
    """
    def __init__(self, checkpoint_dir: str):
        use_cuda = is_cuda_compatible()
        self.device = torch.device("cuda" if use_cuda else "cpu")
        print(f"[Poseidon Swarm] Loading RL policies from {checkpoint_dir} on {self.device}")
        self.policies = {}
        for policy_name in ["scout_policy", "spotter_policy", "rescuer_policy"]:
            net = load_policy_from_checkpoint(policy_name, checkpoint_dir)
            net.to(self.device)
            self.policies[policy_name] = net
            params = sum(p.numel() for p in net.parameters())
            # Describe detected architecture
            arch = " -> ".join(
                str(net.encoder[i].out_features)
                for i in range(0, len(net.encoder), 2)  # skip ReLU layers
            )
            print(f"  [OK] {policy_name} | arch: {net.encoder[0].in_features} -> {arch} -> 9 | {params:,} params on {self.device}")
        print(f"[Poseidon Swarm] All policies ready. No Ray/RLlib dependency. Device: {self.device}")

    def get_action(self, agent_type: str, observation: list) -> int:
        """
        Input:  agent_type ('scout', 'spotter', 'rescuer') + 35-dim observation
        Output: action integer 0-8 (compass direction)
        """
        policy_name = f"{agent_type}_policy"
        if policy_name not in self.policies:
            raise ValueError(f"Unknown agent type: {agent_type}")

        obs_tensor = torch.tensor([observation], dtype=torch.float32).to(self.device)
        action = self.policies[policy_name](obs_tensor)
        return action

    def get_action_batch(self, agent_type: str, observations: list) -> list:
        """Process multiple observations at once for efficiency."""
        policy_name = f"{agent_type}_policy"
        obs_tensor = torch.tensor(observations, dtype=torch.float32).to(self.device)
        with torch.no_grad():
            encoded = self.policies[policy_name].encoder(obs_tensor)
            logits = self.policies[policy_name].action_head(encoded)
            actions = torch.argmax(logits, dim=-1).tolist()
        return actions
