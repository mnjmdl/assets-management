import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_deck(output_path="Crystal_Martin_Assets_Management_Presentation.pptx"):
    prs = Presentation()
    # 16:9 widescreen dimensions (13.33 x 7.5 inches)
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Enterprise Color Palette
    C_NAVY_DARK = RGBColor(15, 23, 42)      # #0F172A
    C_NAVY_LIGHT = RGBColor(30, 41, 59)     # #1E293B
    C_BLUE = RGBColor(2, 132, 199)          # #0284C7 (Brand Blue)
    C_CYAN = RGBColor(14, 165, 233)         # #0EA5E9
    C_WHITE = RGBColor(255, 255, 255)
    C_BG_PAGE = RGBColor(248, 250, 252)     # #F8FAFC
    C_CARD_BG = RGBColor(255, 255, 255)
    C_BORDER = RGBColor(226, 232, 240)      # #E2E8F0
    C_TEXT_MAIN = RGBColor(15, 23, 42)
    C_TEXT_MUTED = RGBColor(100, 116, 139)  # #64748B
    C_GREEN = RGBColor(22, 163, 74)         # #16A34A
    C_AMBER = RGBColor(217, 119, 6)         # #D97706
    C_PURPLE = RGBColor(147, 51, 234)

    def add_header(slide, title_text, category_text="CMBD ENTERPRISE ASSET MANAGEMENT"):
        # Category tag
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.5), Inches(0.35))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        tf_cat.margin_left = tf_cat.margin_top = tf_cat.margin_right = tf_cat.margin_bottom = 0
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.size = Pt(10)
        p_cat.font.bold = True
        p_cat.font.color.rgb = C_BLUE

        # Slide Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.5), Inches(0.7))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = C_TEXT_MAIN

        # Decorative line
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.5), Inches(11.733), Inches(0.02))
        line.fill.solid()
        line.fill.fore_color.rgb = C_BORDER
        line.line.color.rgb = C_BORDER

    def add_card(slide, left, top, width, height, title, items, badge_text=None, badge_color=C_BLUE):
        # Card background
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = C_CARD_BG
        card.line.color.rgb = C_BORDER
        card.line.width = Pt(1)

        cur_top = top + Inches(0.2)
        # Optional Badge
        if badge_text:
            badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left + Inches(0.25), cur_top, Inches(1.4), Inches(0.28))
            badge.fill.solid()
            badge.fill.fore_color.rgb = badge_color
            badge.line.fill.background()
            btf = badge.text_frame
            btf.margin_left = btf.margin_top = btf.margin_right = btf.margin_bottom = 0
            bp = btf.paragraphs[0]
            bp.alignment = PP_ALIGN.CENTER
            bp.text = badge_text.upper()
            bp.font.size = Pt(8.5)
            bp.font.bold = True
            bp.font.color.rgb = C_WHITE
            cur_top += Inches(0.35)

        # Card Title
        tbox = slide.shapes.add_textbox(left + Inches(0.25), cur_top, width - Inches(0.5), Inches(0.4))
        ttf = tbox.text_frame
        ttf.word_wrap = True
        ttf.margin_left = ttf.margin_top = ttf.margin_right = ttf.margin_bottom = 0
        tp = ttf.paragraphs[0]
        tp.text = title
        tp.font.size = Pt(14)
        tp.font.bold = True
        tp.font.color.rgb = C_TEXT_MAIN

        cur_top += Inches(0.4)

        # Card Bullets
        bbox = slide.shapes.add_textbox(left + Inches(0.25), cur_top, width - Inches(0.5), height - (cur_top - top) - Inches(0.2))
        btf = bbox.text_frame
        btf.word_wrap = True
        btf.margin_left = btf.margin_top = btf.margin_right = btf.margin_bottom = 0

        for i, item in enumerate(items):
            p = btf.paragraphs[0] if i == 0 else btf.add_paragraph()
            p.text = f"•  {item}"
            p.font.size = Pt(11)
            p.font.color.rgb = C_TEXT_MUTED
            p.space_after = Pt(6)

    # -------------------------------------------------------------
    # SLIDE 1: Cover Slide
    # -------------------------------------------------------------
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = C_NAVY_DARK
    bg1.line.fill.background()

    # Brand Pill
    pill = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(1.6), Inches(3.2), Inches(0.38))
    pill.fill.solid()
    pill.fill.fore_color.rgb = C_NAVY_LIGHT
    pill.line.color.rgb = C_BLUE
    ptf = pill.text_frame
    ptf.margin_left = ptf.margin_top = ptf.margin_right = ptf.margin_bottom = 0
    pp = ptf.paragraphs[0]
    pp.alignment = PP_ALIGN.CENTER
    pp.text = "CMBD ENTERPRISE  •  ABL GROUP"
    pp.font.size = Pt(10)
    pp.font.bold = True
    pp.font.color.rgb = C_CYAN

    # Main Title
    t_box = s1.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(11.0), Inches(1.8))
    t_tf = t_box.text_frame
    t_tf.word_wrap = True
    p1 = t_tf.paragraphs[0]
    p1.text = "Enterprise Fixed Asset Management"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = C_WHITE

    p2 = t_tf.add_paragraph()
    p2.text = "& Physical Audit Verification Platform"
    p2.font.size = Pt(32)
    p2.font.bold = True
    p2.font.color.rgb = C_CYAN

    # Subtitle
    sub_box = s1.shapes.add_textbox(Inches(1.0), Inches(4.3), Inches(11.0), Inches(1.0))
    s_tf = sub_box.text_frame
    s_tf.word_wrap = True
    sp = s_tf.paragraphs[0]
    sp.text = "End-to-End Asset Registry, Multi-Tier Location Hierarchy, QR/Barcode Tagging, Floor Scanning, Discrepancy Reconciliation & Maintenance Lifecycle"
    sp.font.size = Pt(14)
    sp.font.color.rgb = RGBColor(148, 163, 184)

    # Footer Metadata
    meta_box = s1.shapes.add_textbox(Inches(1.0), Inches(6.0), Inches(11.0), Inches(0.6))
    mtf = meta_box.text_frame
    mp = mtf.paragraphs[0]
    mp.text = "Technology Stack: Next.js 14 Standalone  •  NestJS 10 API  •  MSSQL & Prisma  •  React Native Mobile  •  Ubuntu Linux"
    mp.font.size = Pt(11)
    mp.font.bold = True
    mp.font.color.rgb = C_WHITE

    # -------------------------------------------------------------
    # SLIDE 2: Executive Summary & Challenges Solved
    # -------------------------------------------------------------
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Executive Overview: Modernizing Plant Asset Operations")
    add_card(s2, Inches(0.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Legacy Plant Challenges",
             [
                 "Spreadsheet tracking causes outdated records and duplicate asset codes.",
                 "High incidence of ghost assets (assets on books but physically missing).",
                 "Slow manual annual audits taking weeks of plant downtime.",
                 "Unknown asset relocations between lines, rooms, and units.",
                 "Uncalculated depreciation schedules and delayed maintenance logs.",
             ],
             "PAIN POINTS", C_AMBER)

    add_card(s2, Inches(4.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "The CMBD Solution",
             [
                 "Centralized single source of truth backed by Enterprise MS SQL Server.",
                 "Dynamic 4-tier location hierarchy down to production line/table level.",
                 "QR & Barcode thermal printing with laser-fast mobile camera scanning.",
                 "Automated discrepancy engine classifying verified, missing & misplaced assets.",
                 "Automated Straight-Line depreciation and maintenance alert pipelines.",
             ],
             "CAPABILITIES", C_BLUE)

    add_card(s2, Inches(8.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Key Business Impacts",
             [
                 "90% reduction in physical audit cycle duration across facilities.",
                 "100% custody audit trail from acquisition to disposal.",
                 "Immediate financial valuation accuracy for audit & tax reporting.",
                 "Zero downtime auditing via offline-first mobile sync capabilities.",
                 "Elimination of unrecorded asset loss and equipment hoards.",
             ],
             "MEASURABLE ROI", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 3: System Architecture & Technology Stack
    # -------------------------------------------------------------
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "System Architecture: Modern Multi-Tier Platform")
    add_card(s3, Inches(0.8), Inches(1.8), Inches(2.75), Inches(5.0),
             "Web Portal",
             [
                 "Next.js 14 App Router",
                 "Tailwind CSS & Lucide Icons",
                 "SWR Real-time caching",
                 "Standalone Node.js build",
                 "Role-based UI access",
                 "Responsive Desktop & Tablet",
             ],
             "FRONTEND", C_BLUE)

    add_card(s3, Inches(3.8), Inches(1.8), Inches(2.75), Inches(5.0),
             "Backend API",
             [
                 "NestJS 10 Enterprise Framework",
                 "TypeScript modular services",
                 "Prisma ORM database bridge",
                 "JWT Bearer & Cookie Auth",
                 "Swagger OpenAPI documentation",
                 "Bcrypt credential hashing",
             ],
             "CORE API", C_PURPLE)

    add_card(s3, Inches(6.8), Inches(1.8), Inches(2.75), Inches(5.0),
             "Mobile Scanner",
             [
                 "React Native Expo 52",
                 "Offline-first SQLite local DB",
                 "Camera Barcode & QR HUD",
                 "Laser scan animation & sound",
                 "Bi-directional sync queue",
                 "Android APK & iOS ready",
             ],
             "MOBILE APP", C_CYAN)

    add_card(s3, Inches(9.8), Inches(1.8), Inches(2.75), Inches(5.0),
             "Database & Infra",
             [
                 "Microsoft SQL Server (MSSQL)",
                 "Ubuntu Linux 20.04/22.04 LTS",
                 "Nginx Reverse Proxy & SSL",
                 "PM2 process supervisor",
                 "Automated log rotation",
                 "Air-gapped factory ready",
             ],
             "INFRASTRUCTURE", C_NAVY_DARK)

    # -------------------------------------------------------------
    # SLIDE 4: Facility & Location Hierarchy
    # -------------------------------------------------------------
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Multi-Tier Facility & Location Hierarchy")
    add_card(s4, Inches(0.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "4-Level Physical Topology",
             [
                 "Level 1: Enterprise Organization & Companies (CMBD, ABL Group).",
                 "Level 2: Production Units & Facilities (e.g., Unit 1, Unit 2, Central Warehouse).",
                 "Level 3: Floors & Zones (Ground Floor, 1st Floor Sewing, 2nd Floor Finishing).",
                 "Level 4: Lines, Blocks & Rooms (Sewing Line 04, Cutting Block C, Maintenance Bay).",
                 "Every asset is bound to a specific physical terminal node.",
                 "Prevents cross-facility confusion and pinpoints exact asset coordinates.",
             ],
             "HIERARCHY ENGINE", C_BLUE)

    add_card(s4, Inches(6.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Operational Benefits",
             [
                 "Selective Scope Audits: Conduct audits on a single line, an entire floor, or plant-wide.",
                 "Custody Ownership: Assign departments and custodians to specific rooms.",
                 "Transfer Tracking: When moving between units, origin and destination hierarchies log handoffs.",
                 "Spatial Asset Utilization: Compare machine density and utilization by floor.",
                 "Zero Ambiguity: Eliminates vague location tags like 'Factory Floor'.",
             ],
             "PRECISION TRACKING", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 5: Asset Master Registry
    # -------------------------------------------------------------
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Asset Master Registry & Profile Catalog")
    add_card(s5, Inches(0.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Complete Asset Metadata",
             [
                 "Unique Asset Tag (e.g. AST-004521).",
                 "Serial Number & OEM Part Number.",
                 "Brand, Model & Specification.",
                 "Category (Sewing, Cutting, IT, Boiler).",
                 "Purchase Date, Vendor & Invoice Ref.",
                 "Original Cost & Currency ($ / BDT).",
                 "Warranty expiration date & terms.",
             ],
             "ATTRIBUTES", C_BLUE)

    add_card(s5, Inches(4.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Lifecycle State Machine",
             [
                 "ACTIVE: Operational in production line.",
                 "IN_USE: Assigned to custodian.",
                 "UNDER_MAINTENANCE: In service bay.",
                 "TRANSFERRED: In transit between units.",
                 "MISSING: Flagged during audit session.",
                 "RETIRED / DISPOSED: Written off books.",
                 "Complete timestamped audit log of all status transitions.",
             ],
             "LIFECYCLE", C_PURPLE)

    add_card(s5, Inches(8.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Bulk Operations & Ingestion",
             [
                 "Excel & CSV mass import engine.",
                 "Intelligent column mapping & validation.",
                 "Auto-generates missing asset codes.",
                 "Immediate duplicate detection.",
                 "Instant Excel export with formatted columns.",
                 "Search, filter, and multi-field query.",
             ],
             "DATA OPERATIONS", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 6: Financial Valuation & Depreciation
    # -------------------------------------------------------------
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Financial Valuation & Automated Depreciation Engine")
    add_card(s6, Inches(0.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Straight-Line Engine",
             [
                 "Standardized Straight-Line Depreciation algorithm.",
                 "Configurable useful lifespan (years / months) per category.",
                 "Salvage / Residual value deduction.",
                 "Automated monthly depreciation accrual calculation.",
                 "Prevents depreciating below salvage floor.",
             ],
             "VALUATION RULES", C_BLUE)

    add_card(s6, Inches(4.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Real-Time Book Values",
             [
                 "Live calculation of Current Net Book Value (NBV).",
                 "Accumulated depreciation tracking.",
                 "Real-time plant-wide asset capitalization total.",
                 "Identifies fully depreciated machinery still in production.",
                 "Historical book value curves.",
             ],
             "FINANCIAL METRICS", C_GREEN)

    add_card(s6, Inches(8.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Audit & Compliance",
             [
                 "Fiscal Year start month configuration (e.g. July / January).",
                 "Audit-ready financial balance sheets.",
                 "Exportable depreciation schedules for tax & statutory audits.",
                 "Eliminates manual year-end spreadsheet recalculation errors.",
                 "Complete valuation trail for insurance coverage.",
             ],
             "STATUTORY COMPLIANCE", C_PURPLE)

    # -------------------------------------------------------------
    # SLIDE 7: Smart Tagging & Label Printing
    # -------------------------------------------------------------
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Smart Tagging, QR & Barcode Label Printing")
    add_card(s7, Inches(0.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Label Architecture & Standards",
             [
                 "Standardized QR Format: AST:{assetCode} for rapid parser extraction.",
                 "Readable typography including Company Logo, Asset Code, Name & Category.",
                 "Print-Ready Layouts: Optimized for standard industrial thermal label printers (Zebra, TSC, Honeywell) and A4 laser label sheets.",
                 "Batch Label Generator: Select multiple assets or whole locations and print labels in one click.",
                 "Durable industrial asset tags withstand harsh garment plant heat and washing conditions.",
             ],
             "LABEL GENERATION", C_BLUE)

    add_card(s7, Inches(6.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Scanning Compatibility",
             [
                 "Universal Compatibility: Readable by mobile camera app, standard 2D Bluetooth gun scanners, and USB barcode readers.",
                 "Instant Parsing: Decodes asset code, location ID, and category parameters instantaneously.",
                 "Anti-Tamper & Verification: Matches physical tag against database record to detect swapped tags.",
                 "High-Density QR Code: Scannable even when labels suffer minor scratches or grease.",
             ],
             "HARDWARE SUPPORT", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 8: Mobile Floor Auditing
    # -------------------------------------------------------------
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "Mobile Floor Auditing & High-Speed Scanner")
    add_card(s8, Inches(0.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Operator Experience",
             [
                 "High-speed continuous camera viewfinder.",
                 "Laser HUD targeting line with animated scan sweep.",
                 "Audio beep confirmation & haptic vibration feedback.",
                 "Scan speed under 200ms per asset tag.",
                 "Hands-free rapid scanning through production lines.",
             ],
             "AUDIT WORKFLOW", C_BLUE)

    add_card(s8, Inches(4.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Smart Verification",
             [
                 "Auditor selects Target Location (e.g. Unit 1 > Line 4).",
                 "App loads expected asset roster for that room.",
                 "Instant visual counters: Verified, Missing, Remaining.",
                 "Real-time audio alert when scanning an unexpected asset.",
                 "Custodian verification on-site.",
             ],
             "REAL-TIME LOGIC", C_PURPLE)

    add_card(s8, Inches(8.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Audit Plan Execution",
             [
                 "Formal Audit Session creation with designated auditor.",
                 "Progress tracking bar (% completed).",
                 "Session pause, resume, and formal submission.",
                 "Digital managerial review and sign-off approval.",
                 "Immutable audit lock once session is closed.",
             ],
             "MANAGEMENT", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 9: Discrepancy Detection & Variance Reconciliation
    # -------------------------------------------------------------
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "Automated Discrepancy Detection & Variance Engine")
    add_card(s9, Inches(0.8), Inches(1.8), Inches(2.75), Inches(5.0),
             "1. Verified",
             [
                 "Asset scanned in its designated location.",
                 "Updated with last-scanned timestamp & auditor ID.",
                 "Confidence rating: 100%.",
                 "Marked green in audit ledger.",
             ],
             "MATCH", C_GREEN)

    add_card(s9, Inches(3.8), Inches(1.8), Inches(2.75), Inches(5.0),
             "2. Missing",
             [
                 "Asset expected in room but never scanned.",
                 "Auto-flagged as potentially lost or stolen.",
                 "Alert sent to floor supervisor.",
                 "Trigger for physical search investigation.",
             ],
             "DISCREPANCY", C_AMBER)

    add_card(s9, Inches(6.8), Inches(1.8), Inches(2.75), Inches(5.0),
             "3. Misplaced",
             [
                 "Asset assigned to Line A but found in Line B.",
                 "System alerts auditor of cross-location move.",
                 "One-click auto-relocate or return-to-base ticket.",
                 "Pinpoints unauthorized equipment shifting.",
             ],
             "CROSS-LOCATION", C_BLUE)

    add_card(s9, Inches(9.8), Inches(1.8), Inches(2.75), Inches(5.0),
             "4. Unregistered",
             [
                 "Physical asset found with unknown tag or code.",
                 "Flagged as rogue inventory.",
                 "Option to quick-register on mobile.",
                 "Prevents unrecorded equipment in plant.",
             ],
             "UNKNOWN", C_PURPLE)

    # -------------------------------------------------------------
    # SLIDE 10: Custody Transfers & Movements
    # -------------------------------------------------------------
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "Custody Transfers & Movement Workflows")
    add_card(s10, Inches(0.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Inter-Facility Transfer Pipeline",
             [
                 "Structured Transfer Request: Origin location, destination unit, reason, and transport carrier.",
                 "Asset Selection: Single machine or bulk batch transfer (e.g. moving 20 sewing machines to new line).",
                 "Approval Gate: Requires Asset Manager authorization before dispatch.",
                 "In-Transit Status: Assets marked as 'TRANSFERRED' preventing unauthorized usage during relocation.",
                 "Destination Acknowledgment: Receiving supervisor scans asset barcode to accept delivery and take custody.",
             ],
             "HANDOVER PIPELINE", C_BLUE)

    add_card(s10, Inches(6.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Chain-of-Custody Integrity",
             [
                 "Immutable Transfer History: Complete record of every previous custodian and location.",
                 "Digital Gate Pass generation for security clearance at factory gates.",
                 "Departmental reallocation with cost-center transfer.",
                 "Eliminates lost equipment during factory retooling and seasonal line changes.",
             ],
             "ACCOUNTABILITY", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 11: Preventive & Corrective Maintenance
    # -------------------------------------------------------------
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "Maintenance & Work Order Management")
    add_card(s11, Inches(0.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Service Ticketing",
             [
                 "Log breakdown or preventive maintenance tickets.",
                 "Priority classification (Low, Medium, Critical).",
                 "Assign designated internal or vendor technician.",
                 "Issue description and photo documentation.",
                 "Downtime start and completion timestamps.",
             ],
             "WORK ORDERS", C_BLUE)

    add_card(s11, Inches(4.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Cost & Parts Tracking",
             [
                 "Log spare parts utilized (e.g. motor, needle bar, belt).",
                 "Direct service labor cost recording.",
                 "Accumulated lifetime maintenance cost per asset.",
                 "Identifies high-repair 'lemon' machines ready for replacement.",
                 "Equipment Reliability & MTBF tracking.",
             ],
             "COST ACCOUNTING", C_PURPLE)

    add_card(s11, Inches(8.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Automated Reminders",
             [
                 "Preventive maintenance calendar schedule.",
                 "Configurable 7-day and 30-day proactive service alerts.",
                 "Warranty expiration advance notification.",
                 "In-app badge alerts and notifications dashboard.",
                 "Prevents costly catastrophic machine failure.",
             ],
             "PROACTIVE ALERTS", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 12: Vendor & Supplier Management
    # -------------------------------------------------------------
    s12 = prs.slides.add_slide(blank_layout)
    add_header(s12, "Vendor & Supplier Relationship Management")
    add_card(s12, Inches(0.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Supplier Master Records",
             [
                 "Directory of machinery manufacturers (Juki, Brother, Pegasus, Kansai).",
                 "Contact information: Representative, emergency hotline, email, service address.",
                 "Service Level Agreement (SLA) & warranty policy documentation.",
                 "Contract renewal dates and active supplier status.",
             ],
             "VENDOR DIRECTORY", C_BLUE)

    add_card(s12, Inches(6.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Asset Sourcing & Quality Analysis",
             [
                 "Linked Asset Directory: Filter all machines supplied by a specific vendor.",
                 "Vendor Reliability Scoring: Compare breakdown rates across machine vendors.",
                 "Warranty Claim Assistance: One-click check if broken machine is still under OEM warranty.",
                 "Informed Procurement: Data-driven purchasing decisions for future plant expansion.",
             ],
             "PROCUREMENT ANALYTICS", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 13: Executive Analytics & Reports
    # -------------------------------------------------------------
    s13 = prs.slides.add_slide(blank_layout)
    add_header(s13, "Executive Analytics & Reporting Suite")
    add_card(s13, Inches(0.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Executive Dashboard",
             [
                 "Total Enterprise Assets & Active Inventory Count.",
                 "Total Gross Asset Cost & Current Book Valuation.",
                 "Facility Location Distribution charts.",
                 "Active Maintenance ticket counters.",
                 "Recent audit health & variance indicators.",
             ],
             "KPI DASHBOARD", C_BLUE)

    add_card(s13, Inches(4.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Audit Variance Reports",
             [
                 "Session reconciliation sheets with percentage found.",
                 "Detailed Missing Asset list with last known location.",
                 "Cross-location movement list.",
                 "Auditor productivity & scan timestamps.",
                 "Formal management sign-off documentation.",
             ],
             "AUDIT REPORTS", C_PURPLE)

    add_card(s13, Inches(8.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Export & Integration",
             [
                 "Instant Excel (.xlsx) data export.",
                 "Printable PDF executive reports.",
                 "Audit log retention schedules (365+ days).",
                 "REST API endpoints ready for ERP integration (SAP, Oracle, FastReact).",
                 "System health, memory, and database diagnostics.",
             ],
             "ENTERPRISE EXPORT", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 14: Role-Based Access Control (RBAC) & Security
    # -------------------------------------------------------------
    s14 = prs.slides.add_slide(blank_layout)
    add_header(s14, "Security & Role-Based Access Control (RBAC)")
    add_card(s14, Inches(0.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "5 Granular Security Roles",
             [
                 "SUPER_ADMIN: Full system control, global settings, user creation & edits, category deletion.",
                 "ASSET_MANAGER: Create & edit assets, initiate audit plans, approve transfers, view financial reports.",
                 "AUDITOR: Conduct mobile floor scans, log discrepancies, view assigned room inventories.",
                 "TECHNICIAN: Access maintenance work orders, log repairs, record spare parts & costs.",
                 "EMPLOYEE: Custodian view of personal assigned assets and custody transfer requests.",
             ],
             "ACCESS CONTROL", C_PURPLE)

    add_card(s14, Inches(6.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Enterprise Security Features",
             [
                 "JWT Bearer Authentication: Cryptographically signed tokens with secure expiration.",
                 "Bcrypt Credential Hashing: Salted password hashing with mandatory minimum length.",
                 "User Profile Administration: Edit names, roles, contact numbers, and toggle account activation.",
                 "Self-Profile Management: Users can update personal credentials directly from navigation.",
                 "Environment Protection: Demo credentials automatically hidden in production mode.",
             ],
             "SYSTEM HARDENING", C_BLUE)

    # -------------------------------------------------------------
    # SLIDE 15: Offline-First Mobile Resilience
    # -------------------------------------------------------------
    s15 = prs.slides.add_slide(blank_layout)
    add_header(s15, "Offline-First Mobile Architecture (Factory Floor Ready)")
    add_card(s15, Inches(0.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Industrial Connectivity Realities",
             [
                 "Garment plants and industrial basements frequently experience Wi-Fi dead zones.",
                 "Standard web apps fail or freeze when network drops during floor scanning.",
                 "CMBD Mobile incorporates SQLite embedded database on device.",
                 "Auditors download target room roster before stepping onto the floor.",
                 "Continuous scanning operates 100% locally with zero latency or network dependence.",
             ],
             "OFFLINE CHALLENGE", C_AMBER)

    add_card(s15, Inches(6.8), Inches(1.8), Inches(5.7), Inches(5.0),
             "Sync Engine & Conflict Resolution",
             [
                 "Outbox Queue: Scanned records store locally with high-resolution timestamps.",
                 "Auto-Detection: App detects network restoration and pushes queued audit logs.",
                 "Smart Conflict Resolution: Server reconciles concurrent scans with idempotent transactions.",
                 "Offline Sync Badge: Real-time status indicator shows pending sync queue count.",
                 "Guaranteed Zero Data Loss during plant-wide network interruptions.",
             ],
             "RESILIENT SYNC", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 16: Deployment & Infrastructure
    # -------------------------------------------------------------
    s16 = prs.slides.add_slide(blank_layout)
    add_header(s16, "Production Deployment & Infrastructure")
    add_card(s16, Inches(0.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "Ubuntu Linux Production",
             [
                 "Clean standalone production distribution (deploy-ubuntu.tar.gz).",
                 "Nginx reverse proxy on Port 80 routing /api/ and /* seamlessly.",
                 "PM2 daemon supervisor managing 'assets-api' and 'assets-web'.",
                 "Automatic server reboot startup (pm2 startup).",
                 "Gzip compression & static asset caching.",
             ],
             "UBUNTU SERVER", C_NAVY_DARK)

    add_card(s16, Inches(4.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "MSSQL Enterprise DB",
             [
                 "Direct integration with enterprise Microsoft SQL Server.",
                 "Multi-tier configuration fallback with dynamic runtime loading.",
                 "Prisma connection pooling with encryption and trust certificate support.",
                 "Cross-platform OpenSSL 3.0.x query engine.",
             ],
             "ENTERPRISE DATABASE", C_BLUE)

    add_card(s16, Inches(8.8), Inches(1.8), Inches(3.7), Inches(5.0),
             "One-Click Maintenance",
             [
                 "One-command deployment and update overwrite.",
                 "Automatic environment synchronization (root .env to api/.env).",
                 "Instant PM2 reload with --update-env.",
                 "Centralized logs in /var/www/assets-management/logs/.",
             ],
             "OPERATIONS & CI/CD", C_GREEN)

    # -------------------------------------------------------------
    # SLIDE 17: Summary & Conclusion
    # -------------------------------------------------------------
    s17 = prs.slides.add_slide(blank_layout)
    bg17 = s17.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg17.fill.solid()
    bg17.fill.fore_color.rgb = C_NAVY_DARK
    bg17.line.fill.background()

    # Title
    t17_box = s17.shapes.add_textbox(Inches(1.0), Inches(1.2), Inches(11.0), Inches(1.2))
    t17_tf = t17_box.text_frame
    t17_tf.word_wrap = True
    p17_1 = t17_tf.paragraphs[0]
    p17_1.text = "Transforming Factory Asset Intelligence"
    p17_1.font.size = Pt(34)
    p17_1.font.bold = True
    p17_1.font.color.rgb = C_WHITE

    p17_2 = t17_tf.add_paragraph()
    p17_2.text = "Summary of Transformational Capabilities"
    p17_2.font.size = Pt(20)
    p17_2.font.color.rgb = C_CYAN

    # 3 Summary Cards
    def add_dark_card(slide, left, top, width, height, title, items, badge_text):
        c = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        c.fill.solid()
        c.fill.fore_color.rgb = C_NAVY_LIGHT
        c.line.color.rgb = C_BLUE
        c.line.width = Pt(1)

        b = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left + Inches(0.25), top + Inches(0.2), Inches(1.4), Inches(0.28))
        b.fill.solid()
        b.fill.fore_color.rgb = C_BLUE
        b.line.fill.background()
        btf = b.text_frame
        btf.margin_left = btf.margin_top = btf.margin_right = btf.margin_bottom = 0
        bp = btf.paragraphs[0]
        bp.alignment = PP_ALIGN.CENTER
        bp.text = badge_text
        bp.font.size = Pt(8.5)
        bp.font.bold = True
        bp.font.color.rgb = C_WHITE

        tbox = slide.shapes.add_textbox(left + Inches(0.25), top + Inches(0.55), width - Inches(0.5), Inches(0.4))
        ttf = tbox.text_frame
        ttf.word_wrap = True
        ttf.margin_left = ttf.margin_top = ttf.margin_right = ttf.margin_bottom = 0
        tp = ttf.paragraphs[0]
        tp.text = title
        tp.font.size = Pt(14)
        tp.font.bold = True
        tp.font.color.rgb = C_WHITE

        bbox = slide.shapes.add_textbox(left + Inches(0.25), top + Inches(0.95), width - Inches(0.5), height - Inches(1.1))
        btf = bbox.text_frame
        btf.word_wrap = True
        btf.margin_left = btf.margin_top = btf.margin_right = btf.margin_bottom = 0
        for i, it in enumerate(items):
            p = btf.paragraphs[0] if i == 0 else btf.add_paragraph()
            p.text = f"✓  {it}"
            p.font.size = Pt(11)
            p.font.color.rgb = RGBColor(203, 213, 225)
            p.space_after = Pt(6)

    add_dark_card(s17, Inches(1.0), Inches(2.6), Inches(3.5), Inches(3.6),
                  "Complete Visibility",
                  [
                      "Live registry of every machine & asset.",
                      "Exact floor, line & custodian records.",
                      "QR code label verification.",
                      "Preventive maintenance tracking.",
                  ],
                  "CONTROL")

    add_dark_card(s17, Inches(4.9), Inches(2.6), Inches(3.5), Inches(3.6),
                  "Rapid Audit Execution",
                  [
                      "Floor scanning at 200ms per tag.",
                      "Zero Wi-Fi dependence on mobile.",
                      "Instant 4-way discrepancy tagging.",
                      "Reduced audit cycle from weeks to hours.",
                  ],
                  "EFFICIENCY")

    add_dark_card(s17, Inches(8.8), Inches(2.6), Inches(3.5), Inches(3.6),
                  "Financial & Security",
                  [
                      "Automated Straight-Line depreciation.",
                      "Net book values for statutory reporting.",
                      "5-tier Role-Based Access Control.",
                      "High-availability Ubuntu & MSSQL infra.",
                  ],
                  "COMPLIANCE")

    prs.save(output_path)
    print(f"✅ Successfully generated PowerPoint presentation: {output_path}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "Crystal_Martin_Assets_Management_Presentation.pptx"
    create_deck(out_file)

