import logging

from django.core.management.base import BaseCommand

from knowledge.models import KnowledgeDocument

logger = logging.getLogger(__name__)

KNOWLEDGE_BASE = [
    {
        'id': 'charging-ccs2',
        'title': 'CCS2 Charging Standard',
        'source': 'ev_knowledge',
        'content': (
            'CCS2 (Combined Charging System Type 2) is the standard DC fast charging connector '
            'adopted by India under the Bharat EV standards. It combines the Type 2 AC connector '
            'with two additional DC pins at the bottom. CCS2 supports charging power up to 350 kW '
            'in ultra-fast chargers and 50 kW in standard DC fast chargers. Most modern EVs in India '
            '(Tata Nexon EV, MG ZS EV, Hyundai Kona, Kia EV6) use CCS2. It supports Plug and Charge '
            'and is backward compatible with Type 2 AC charging.'
        ),
    },
    {
        'id': 'charging-chademo',
        'title': 'CHAdeMO Charging Standard',
        'source': 'ev_knowledge',
        'content': (
            'CHAdeMO is a DC fast charging standard developed by Japanese manufacturers. '
            'It uses a separate connector (not combined with AC). CHAdeMO supports up to 400 kW '
            'in its latest version. In India, CHAdeMO is less common than CCS2 but some older '
            'Japanese EVs (Nissan Leaf) use it. CHAdeMO-to-CCS2 adapters are available. '
            'CHAdeMO supports V2G (Vehicle-to-Grid) natively.'
        ),
    },
    {
        'id': 'charging-type2-ac',
        'title': 'Type 2 AC Charging',
        'source': 'ev_knowledge',
        'content': (
            'Type 2 AC (Mennekes) is the standard AC charging connector used in India and Europe. '
            'It supports single-phase (3.3-7.4 kW) and three-phase (11-22 kW) AC charging. '
            'All modern Indian EVs use Type 2 AC for home and workplace charging. '
            'AC charging is slower but more convenient for overnight charging. '
            'A typical 7.4 kW AC charger adds about 40-50 km of range per hour.'
        ),
    },
    {
        'id': 'battery-lfp',
        'title': 'LFP Battery Technology',
        'source': 'ev_knowledge',
        'content': (
            'LFP (Lithium Iron Phosphate) batteries are increasingly popular in EVs due to their '
            'longer cycle life (2000+ cycles), better thermal stability, and lower cost. '
            'They have lower energy density (90-160 Wh/kg) compared to NMC (150-250 Wh/kg). '
            'LFP batteries can be safely charged to 100% regularly without significant degradation. '
            'Tata Motors uses LFP batteries in its Nexon EV and Tiago EV models. '
            'They perform better in hot climates and are less prone to thermal runaway.'
        ),
    },
    {
        'id': 'battery-nmc',
        'title': 'NMC Battery Technology',
        'source': 'ev_knowledge',
        'content': (
            'NMC (Nickel Manganese Cobalt) batteries offer higher energy density (150-250 Wh/kg) '
            'compared to LFP, making them suitable for longer-range EVs. They have a shorter cycle '
            'life (1000-1500 cycles) and are more expensive. NMC batteries are more sensitive to '
            'high temperatures and frequent fast charging. Recommended charging limit is 80-90% '
            'for daily use to maximize battery life. Used in premium EVs like Kia EV6, BMW i4, '
            'and Mercedes EQS.'
        ),
    },
    {
        'id': 'battery-degradation',
        'title': 'EV Battery Degradation',
        'source': 'ev_knowledge',
        'content': (
            'EV batteries degrade over time due to: (1) Calendar aging - chemical degradation regardless '
            'of use; (2) Cycle aging - degradation from charge/discharge cycles. Key factors: high '
            'temperatures accelerate degradation; frequent DC fast charging increases wear; '
            'charging to 100% regularly stresses the battery; deep discharges below 10% are harmful. '
            'Typical degradation: 1-2% per year for modern EVs with thermal management. '
            'Most manufacturers offer 8-year/160,000 km battery warranty.'
        ),
    },
    {
        'id': 'charging-optimal-soc',
        'title': 'Optimal Charging Practices',
        'source': 'ev_knowledge',
        'content': (
            'For maximum battery life: keep state of charge between 20-80% for daily driving. '
            'Charge to 100% only for long trips. Use AC charging for daily needs, DC fast charging '
            'for long journeys. The charging speed slows significantly above 80% SoC to protect the '
            'battery. Pre-condition the battery in cold weather before fast charging. '
            'Arriving at a fast charger with 10-20% SoC yields the fastest charging speeds. '
            'One longer charging stop is better than multiple short stops.'
        ),
    },
    {
        'id': 'range-optimization',
        'title': 'EV Range Optimization Tips',
        'source': 'ev_knowledge',
        'content': (
            'To maximize EV range: maintain steady speed (60-80 km/h is most efficient); '
            'use regenerative braking in city traffic; pre-condition cabin while plugged in; '
            'avoid carrying unnecessary weight; keep tires properly inflated; use Eco mode; '
            'plan routes to avoid steep gradients. Cold weather reduces range by 20-30% '
            'due to increased air density and battery chemistry effects. '
            'Hot weather above 35C reduces efficiency due to AC and battery cooling loads.'
        ),
    },
    {
        'id': 'regen-braking',
        'title': 'Regenerative Braking',
        'source': 'ev_knowledge',
        'content': (
            'Regenerative braking captures kinetic energy during deceleration and converts it '
            'to electricity to charge the battery. Most EVs offer multiple regen levels. '
            'One-pedal driving allows the car to come to a complete stop using only regen. '
            'Regen is most effective in city stop-and-go traffic. Highway driving uses less regen. '
            'Regen efficiency is typically 60-70% in ideal conditions. '
            'In cold weather, regen may be limited until the battery warms up.'
        ),
    },
    {
        'id': 'fame-subsidy',
        'title': 'FAME India Subsidy Scheme',
        'source': 'ev_knowledge',
        'content': (
            'FAME (Faster Adoption and Manufacturing of Electric Vehicles) India is the government\'s '
            'flagship EV subsidy program. FAME II (2019-2024) provided subsidies for EVs, '
            'charging infrastructure, and R&D. The scheme covers electric buses, 3-wheelers, '
            '2-wheelers, and passenger cars. For passenger EVs, subsidies were up to Rs 1.5 lakh '
            'depending on battery capacity. FAME III is expected to continue with increased focus '
            'on public charging infrastructure.'
        ),
    },
    {
        'id': 'bharat-ev-standards',
        'title': 'Bharat EV Charging Standards',
        'source': 'ev_knowledge',
        'content': (
            'India has adopted Bharat EV standards for charging infrastructure: '
            'Bharat DC-001 (15 kW DC, CHAdeMO/CCS2), Bharat AC-001 (3.3 kW AC, Type 2). '
            'The government mandates CCS2 as the standard DC fast charging connector. '
            'All public fast chargers installed after 2022 must support CCS2. '
            'AC chargers use Type 2 (Mennekes) connectors for AC and DC combined.'
        ),
    },
    {
        'id': 'eco-charge-booking',
        'title': 'EcoCharge Booking System',
        'source': 'manual',
        'content': (
            'EcoCharge allows users to book charging slots at partner stations. '
            'Users can: search stations by location or route; filter by connector type and availability; '
            'book slots for specific times; cancel bookings; view booking history. '
            'Bookings have auto-expiry (handled by Celery) if not confirmed within the window. '
            'Slot rates vary by time of day (peak/off-peak). '
            'Payment is via Razorpay.'
        ),
    },
    {
        'id': 'planner-algorithm',
        'title': 'EcoCharge Route Planner Algorithm',
        'source': 'manual',
        'content': (
            'The route planner uses an energy-aware multi-stop algorithm: '
            '(1) Precomputes route geometry via OSRM; '
            '(2) Identifies corridor charging stations within 30 km of the route; '
            '(3) Simulates battery consumption along the route; '
            '(4) When battery drops below threshold, selects optimal charging stop; '
            '(5) Scores stations by: drive time + charging time + detour time; '
            '(6) DC chargers are preferred over AC for faster charging; '
            '(7) Vehicle-specific charging curves are used for accurate time estimates; '
            '(8) Safety buffer of 15% is maintained at all times; '
            '(9) Arriving with 10-20% SoC is ideal for fastest charging speeds.'
        ),
    },
    {
        'id': 'planner-charger-selection',
        'title': 'Charger Selection Criteria',
        'source': 'manual',
        'content': (
            'The planner selects charging stations based on: '
            '(1) Distance from route (prefers stations within 5 km corridor); '
            '(2) Charger type (DC Ultra > DC Fast > AC Fast > AC Slow); '
            '(3) Availability (available slots ranked higher); '
            '(4) Pricing (cost per kWh); '
            '(5) Estimated detour time; '
            '(6) Charging speed based on vehicle\'s max charge rate. '
            'The planner scores all candidate stations and picks the optimal one. '
            'For "fastest" strategy: minimizes total trip time (drive + charge). '
            'For "cheapest" strategy: minimizes total charging cost.'
        ),
    },
]


class Command(BaseCommand):
    help = 'Ingest static EV knowledge base into the RAG document store'

    def add_arguments(self, parser):
        parser.add_argument(
            '--embed',
            action='store_true',
            help='Generate and store embeddings after ingestion',
        )

    def handle(self, *args, **options):
        self.stdout.write(f'Ingesting {len(KNOWLEDGE_BASE)} documents...')

        created = 0
        updated = 0
        for doc_data in KNOWLEDGE_BASE:
            doc_id = doc_data['id']
            try:
                doc = KnowledgeDocument.objects.get(pk=doc_id)
                for key, value in doc_data.items():
                    setattr(doc, key, value)
                doc.save()
                updated += 1
            except KnowledgeDocument.DoesNotExist:
                KnowledgeDocument.objects.create(**doc_data)
                created += 1

        self.stdout.write(self.style.SUCCESS(f'Created: {created}, Updated: {updated}'))

        if options['embed']:
            self._generate_embeddings()

    def _generate_embeddings(self):
        from sentence_transformers import SentenceTransformer
        self.stdout.write('Generating embeddings...')
        try:
            model = SentenceTransformer('all-MiniLM-L6-v2')
            docs = KnowledgeDocument.objects.filter(embedding__isnull=True)
            if not docs.exists():
                docs = KnowledgeDocument.objects.all()

            for doc in docs:
                emb = model.encode(doc.content).tolist()
                doc.embedding = emb
                doc.save(update_fields=['embedding'])

            self.stdout.write(self.style.SUCCESS(f'Embedded {docs.count()} documents'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Embedding failed: {e}'))
