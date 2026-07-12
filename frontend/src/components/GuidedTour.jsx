import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, Map, Activity, Video, Radio, Cloud, Cpu, Crosshair, Anchor } from 'lucide-react'

const TOUR_DATA = {
  en: [
    {
      target: '.app-layout > header, .mission-control, .app-layout > :first-child',
      fallbackSelector: '.app-layout',
      title: 'Mission Control Bar',
      icon: Anchor,
      iconColor: '#22d3ee',
      description: 'The top command bar is where the Coast Guard operator manages the entire SAR operation. It contains the mission mode buttons:',
      bullets: [
        'Deploy FLEET (Live RT) — connects to physical drone hardware via MAVLink protocol.',
        'Run System Demo — runs the full AI simulation with virtual drones for demonstration.',
        'Replay DB — replays a past mission from the SQLite flight recorder.',
        'System Guide — the tour you are viewing right now.'
      ],
      position: 'bottom'
    },
    {
      target: '.panel-weather',
      title: 'Live Environment Panel',
      icon: Cloud,
      iconColor: '#38bdf8',
      description: 'Real-time marine weather data pulled from the Open-Meteo Ocean API. This feeds directly into the Drift ONNX neural network.',
      bullets: [
        'Wind Speed & Direction — affects how fast the victim drifts.',
        'Wave Height — affects search difficulty classification.',
        'Current Speed — ocean surface current velocity in m/s.'
      ],
      position: 'right'
    },
    {
      target: '.panel-map',
      title: 'Tactical Map',
      icon: Map,
      iconColor: '#22d3ee',
      description: 'The central geographic command interface rendering live GPS coordinates of all fleet agents on CartoDB dark ocean tiles.',
      bullets: [
        '🛸 Blue = Scout drones (RL-driven search sweep).',
        '🔍 Yellow = Spotter drone (visual lock-on tracking).',
        '🚤 Red = Rescue boats (drift-predicted intercept path).',
        '🟣 Purple = Person In Water (PIW) target.',
        'Click anywhere on the map to drop an SOS Distress Pin before deploying.'
      ],
      position: 'top'
    },
    {
      target: '.panel-telemetry',
      title: 'Mission Telemetry',
      icon: Activity,
      iconColor: '#10b981',
      description: 'Live mission statistics and fleet health monitoring dashboard.',
      bullets: [
        'Mission Timer — total elapsed time since fleet deployment.',
        'TTD (Time To Detect) — seconds until YOLO confirms a visual signature.',
        'TTR (Time To Rescue) — seconds until the rescue boat reaches the victim.',
        'Area Coverage — percentage of the search grid swept by the RL swarm.',
        'Fleet Status — real-time battery levels and agent status indicators.'
      ],
      position: 'left'
    },
    {
      target: '.panel-video',
      title: 'Drone Camera Feed',
      icon: Video,
      iconColor: '#f59e0b',
      description: 'Simulates the onboard FLIR/RGB camera payload from the selected drone. Click any drone on the map to switch feeds.',
      bullets: [
        'Shows live telemetry overlay (altitude, heading, GPS coordinates).',
        'When a drone approaches the victim, the YOLO PyTorch model runs inference in the backend.',
        'The bounding box "Lock-On" visually confirms the AI detection in real-time.'
      ],
      position: 'top'
    },
    {
      target: '.panel-commlink',
      title: 'Swarm Comm-Link Terminal',
      icon: Radio,
      iconColor: '#ef4444',
      description: 'The raw log stream from the Python FastAPI backend engine. This is the proof that real AI models are executing.',
      bullets: [
        'Watch the RL Policy actions (compass directions) being computed per agent.',
        'See when the Open-Meteo API is queried for live weather.',
        'See the exact moment YOLO inference confirms target detection.',
        'See the Drift ONNX model output its dx/dy prediction vectors.'
      ],
      position: 'top'
    }
  ],
  fr: [
    {
      target: '.app-layout > header, .mission-control, .app-layout > :first-child',
      fallbackSelector: '.app-layout',
      title: 'Barre de Contrôle de Mission',
      icon: Anchor,
      iconColor: '#22d3ee',
      description: 'La barre de commande supérieure est l\'endroit où l\'opérateur des garde-côtes gère l\'ensemble de l\'opération SAR.',
      bullets: [
        'Déployer FLOTTE (Temps Réel) — se connecte au matériel physique du drone via le protocole MAVLink.',
        'Lancer Simulation — exécute la simulation complète de l\'IA avec des drones virtuels pour la démonstration.',
        'Rejouer Mission — rejoue une mission passée à partir de l\'enregistreur de vol SQLite.',
        'Guide Système — la visite guidée que vous consultez en ce moment.'
      ],
      position: 'bottom'
    },
    {
      target: '.panel-weather',
      title: 'Panneau d\'Environnement en Direct',
      icon: Cloud,
      iconColor: '#38bdf8',
      description: 'Données météorologiques marines en temps réel extraites de l\'API océanique Open-Meteo. Celles-ci alimentent directement le réseau neuronal Drift ONNX.',
      bullets: [
        'Vitesse et direction du vent — affecte la vitesse de dérive de la victime.',
        'Hauteur des vagues — affecte la classification de la difficulté de recherche.',
        'Vitesse du courant — vitesse du courant de surface de l\'océan en m/s.'
      ],
      position: 'right'
    },
    {
      target: '.panel-map',
      title: 'Carte Tactique',
      icon: Map,
      iconColor: '#22d3ee',
      description: 'L\'interface de commandement géographique centrale qui affiche les coordonnées GPS en direct de tous les agents de la flotte sur des tuiles océaniques sombres CartoDB.',
      bullets: [
        '🛸 Bleu = Drones éclaireurs (balayage de recherche piloté par l\'apprentissage par renforcement).',
        '🔍 Jaune = Drone observateur (suivi de verrouillage visuel).',
        '🚤 Rouge = Bateaux de sauvetage (trajectoire d\'interception prévue par la dérive).',
        '🟣 Violet = Cible (Personne à la mer).',
        'Cliquez n\'importe où sur la carte pour déposer un marqueur de détresse SOS avant le déploiement.'
      ],
      position: 'top'
    },
    {
      target: '.panel-telemetry',
      title: 'Télémétrie de Mission',
      icon: Activity,
      iconColor: '#10b981',
      description: 'Statistiques de mission en direct et tableau de bord de surveillance de l\'état de la flotte.',
      bullets: [
        'Chronomètre de mission — temps total écoulé depuis le déploiement de la flotte.',
        'TTD (Temps de Détection) — secondes jusqu\'à ce que YOLO confirme une signature visuelle.',
        'TTR (Temps de Sauvetage) — secondes jusqu\'à ce que le bateau de sauvetage atteigne la victime.',
        'Couverture de zone — pourcentage de la grille de recherche balayée par l\'essaim RL.',
        'État de la flotte — niveaux de batterie en temps réel et indicateurs d\'état des agents.'
      ],
      position: 'left'
    },
    {
      target: '.panel-video',
      title: 'Flux Caméra Drone',
      icon: Video,
      iconColor: '#f59e0b',
      description: 'Simule la charge utile de la caméra FLIR/RGB embarquée du drone sélectionné. Cliquez sur un drone sur la carte pour changer de flux.',
      bullets: [
        'Affiche la superposition télémétrique en direct (altitude, cap, coordonnées GPS).',
        'Lorsqu\'un drone s\'approche de la victime, le modèle YOLO PyTorch exécute l\'inférence en arrière-plan.',
        'La boîte de délimitation de verrouillage confirme visuellement la détection de l\'IA en temps réel.'
      ],
      position: 'top'
    },
    {
      target: '.panel-commlink',
      title: 'Terminal de Liaison de l\'Essaim',
      icon: Radio,
      iconColor: '#ef4444',
      description: 'Le flux de journalisation brut du moteur principal Python FastAPI. C\'est la preuve que de vrais modèles d\'IA sont exécutés.',
      bullets: [
        'Observez les actions de la politique RL (directions de la boussole) calculées pour chaque agent.',
        'Découvrez le moment où l\'API Open-Meteo est interrogée pour obtenir les conditions météorologiques en direct.',
        'Découvrez le moment précis où l\'inférence YOLO confirme la détection de la cible.',
        'Découvrez le modèle Drift ONNX générer ses vecteurs de prédiction dx/dy.'
      ],
      position: 'top'
    }
  ],
  ar: [
    {
      target: '.app-layout > header, .mission-control, .app-layout > :first-child',
      fallbackSelector: '.app-layout',
      title: 'شريط تحكم المهمة',
      icon: Anchor,
      iconColor: '#22d3ee',
      description: 'شريط الأوامر العلوي هو المكان الذي يدير فيه عامل خفر السواحل عملية البحث والإنقاذ بأكملها.',
      bullets: [
        'نشر الأسطول (الوقت الفعلي) — يتصل بأجهزة الطائرات بدون طيار الفعلية عبر بروتوكول MAVLink.',
        'تشغيل المحاكاة — يقوم بتشغيل محاكاة الذكاء الاصطناعي الكاملة مع طائرات بدون طيار افتراضية للتوضيح.',
        'إعادة المهمة — يعيد تشغيل مهمة سابقة من مسجل رحلة SQLite.',
        'دليل النظام — الجولة التي تشاهدها الآن.'
      ],
      position: 'bottom'
    },
    {
      target: '.panel-weather',
      title: 'لوحة البيئة المباشرة',
      icon: Cloud,
      iconColor: '#38bdf8',
      description: 'بيانات الطقس البحري في الوقت الفعلي مسحوبة من واجهة برمجة تطبيقات Open-Meteo. وهذا يغذي مباشرة الشبكة العصبية Drift ONNX.',
      bullets: [
        'سرعة الرياح واتجاهها — يؤثر على مدى سرعة انجراف الضحية.',
        'ارتفاع الأمواج — يؤثر على تصنيف صعوبة البحث.',
        'سرعة التيار — سرعة تيار سطح المحيط م/ث.'
      ],
      position: 'right'
    },
    {
      target: '.panel-map',
      title: 'الخريطة التكتيكية',
      icon: Map,
      iconColor: '#22d3ee',
      description: 'واجهة القيادة الجغرافية المركزية التي تعرض إحداثيات GPS المباشرة لجميع وكلاء الأسطول على بلاط محيط CartoDB المظلم.',
      bullets: [
        '🛸 أزرق = طائرات كشافة (مسح بحثي مدفوع بالتعلم المعزز RL).',
        '🔍 أصفر = طائرة مراقبة (تتبع بصري وتثبيت).',
        '🚤 أحمر = قوارب إنقاذ (مسار اعتراض متوقع بالانجراف).',
        '🟣 أرجواني = الهدف (شخص في الماء).',
        'انقر في أي مكان على الخريطة لإسقاط دبوس استغاثة SOS قبل النشر.'
      ],
      position: 'top'
    },
    {
      target: '.panel-telemetry',
      title: 'القياس عن بعد للمهمة',
      icon: Activity,
      iconColor: '#10b981',
      description: 'إحصائيات المهمة الحية ولوحة تحكم مراقبة صحة الأسطول.',
      bullets: [
        'مؤقت المهمة — إجمالي الوقت المنقضي منذ نشر الأسطول.',
        'TTD (وقت الاكتشاف) — ثوانٍ حتى يؤكد YOLO بصمة بصرية.',
        'TTR (وقت الإنقاذ) — ثوانٍ حتى يصل قارب الإنقاذ إلى الضحية.',
        'تغطية المنطقة — النسبة المئوية لشبكة البحث التي تم مسحها بواسطة السرب.',
        'حالة الأسطول — مستويات البطارية في الوقت الفعلي ومؤشرات حالة الوكيل.'
      ],
      position: 'left'
    },
    {
      target: '.panel-video',
      title: 'تغذية كاميرا الطائرة بدون طيار',
      icon: Video,
      iconColor: '#f59e0b',
      description: 'يحاكي حمولة الكاميرا FLIR/RGB المدمجة من الطائرة بدون طيار المحددة. انقر على أي طائرة على الخريطة للتبديل.',
      bullets: [
        'يعرض تراكب القياس عن بعد المباشر (الارتفاع، الاتجاه، إحداثيات GPS).',
        'عندما تقترب طائرة من الضحية، يقوم نموذج YOLO PyTorch بتشغيل الاستدلال في الخلفية.',
        'يؤكد المربع المحيط بصريًا اكتشاف الذكاء الاصطناعي في الوقت الفعلي.'
      ],
      position: 'top'
    },
    {
      target: '.panel-commlink',
      title: 'محطة اتصال السرب',
      icon: Radio,
      iconColor: '#ef4444',
      description: 'دفق السجل الأولي من محرك خلفية Python FastAPI. هذا هو الدليل على تنفيذ نماذج الذكاء الاصطناعي.',
      bullets: [
        'شاهد إجراءات سياسة RL (اتجاهات البوصلة) التي يتم حسابها لكل وكيل.',
        'شاهد متى يتم الاستعلام عن واجهة برمجة تطبيقات Open-Meteo للطقس المباشر.',
        'شاهد اللحظة المحددة التي يؤكد فيها استدلال YOLO اكتشاف الهدف.',
        'شاهد نموذج Drift ONNX يخرج متجهات التنبؤ dx/dy.'
      ],
      position: 'top'
    }
  ]
}

export default function GuidedTour({ onClose, lang = 'en' }) {
  const [step, setStep] = useState(0)
  const [tooltipStyle, setTooltipStyle] = useState({})
  const [spotlightStyle, setSpotlightStyle] = useState({})
  const tooltipRef = useRef(null)
  
  const currentTourSteps = TOUR_DATA[lang] || TOUR_DATA['en']
  const current = currentTourSteps[step]
  const Icon = current.icon

  useEffect(() => {
    const el = document.querySelector(current.target)
    if (!el) {
      // Fallback: center the tooltip
      setSpotlightStyle({ display: 'none' })
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      })
      return
    }

    const rect = el.getBoundingClientRect()
    const pad = 6

    // Spotlight position
    setSpotlightStyle({
      position: 'fixed',
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      borderRadius: 12
    })

    // Tooltip positioning based on step preference
    const pos = current.position
    const tooltipWidth = 380
    const tooltipHeight = 340
    let top, left

    if (pos === 'bottom') {
      top = rect.bottom + 14
      left = rect.left + rect.width / 2 - tooltipWidth / 2
    } else if (pos === 'top') {
      top = rect.top - tooltipHeight - 14
      left = rect.left + rect.width / 2 - tooltipWidth / 2
    } else if (pos === 'right') {
      top = rect.top + rect.height / 2 - tooltipHeight / 2
      left = rect.right + 14
    } else if (pos === 'left') {
      top = rect.top + rect.height / 2 - tooltipHeight / 2
      left = rect.left - tooltipWidth - 14
    }

    // Clamp to viewport
    top = Math.max(10, Math.min(top, window.innerHeight - tooltipHeight - 10))
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10))

    setTooltipStyle({
      position: 'fixed',
      top,
      left,
      width: tooltipWidth
    })
  }, [step, lang, current])

  const goNext = () => {
    if (step < currentTourSteps.length - 1) setStep(step + 1)
    else onClose()
  }
  const goBack = () => {
    if (step > 0) setStep(step - 1)
  }
  
  const getText = (key) => {
    if (lang === 'fr') {
      if (key === 'Back') return 'Retour'
      if (key === 'Next') return 'Suivant'
      if (key === 'Finish') return 'Terminer'
    }
    if (lang === 'ar') {
      if (key === 'Back') return 'رجوع'
      if (key === 'Next') return 'التالي'
      if (key === 'Finish') return 'إنهاء'
    }
    return key
  }

  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      <div className="tour-overlay" onClick={onClose}>
        <div className="tour-spotlight" style={spotlightStyle} />
      </div>

      {/* Tooltip card */}
      <div className="tour-tooltip" style={{...tooltipStyle, direction: lang === 'ar' ? 'rtl' : 'ltr', textAlign: lang === 'ar' ? 'right' : 'left'}} ref={tooltipRef}>
        {/* Step counter + Close */}
        <div className="tour-tooltip-header">
          <span className="tour-step-counter">{step + 1} / {currentTourSteps.length}</span>
          <button className="tour-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Title */}
        <h3 className="tour-title" style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', justifyContent: lang === 'ar' ? 'flex-end' : 'flex-start' }}>
          <Icon size={20} color={current.iconColor} />
          {current.title}
        </h3>

        {/* Description */}
        <p className="tour-description">{current.description}</p>

        {/* Bullet points */}
        {current.bullets && (
          <ul className="tour-bullets" style={{ paddingLeft: lang === 'ar' ? 0 : 18, paddingRight: lang === 'ar' ? 18 : 0 }}>
            {current.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}

        {/* Navigation */}
        <div className="tour-nav" style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }}>
          <button
            className="tour-nav-btn"
            onClick={goBack}
            disabled={step === 0}
            style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }}
          >
            {lang === 'ar' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />} {getText('Back')}
          </button>

          {/* Progress dots */}
          <div className="tour-dots" style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }}>
            {currentTourSteps.map((_, i) => (
              <span
                key={i}
                className={`tour-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
                onClick={() => setStep(i)}
              />
            ))}
          </div>

          <button className="tour-nav-btn tour-nav-next" onClick={goNext} style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }}>
            {step === currentTourSteps.length - 1 ? getText('Finish') : getText('Next')} {lang === 'ar' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </>
  )
}
