A. Capture \& Measurement



AR wall capture: Phone camera + plane detection to outline walls; tap-to-mark doors/windows; calculates square footage and linear trim automatically.



Reference-object photogrammetry: Snap each wall with a standard object (sheet of paper, A4/Letter) auto-detected to infer scale; stitches a room model, computes surfaces + paint volumes.



Ceiling height inference: Estimation via door height heuristics + perspective (option to override).



Trim \& baseboard classifier: CV model tags crown/baseboard/chair rail; separates finish type + linear footage.



Surface condition detection: AI flags patching, stains, cracking, orange-peel vs. smooth, recommending prep time and materials.



Color extraction from photo: Picks current wall color into a digital swatch; offers closest matches in major pro lines (Benjamin Moore, Sherwin-Williams, etc.).



Room set templates: “3-bed semi,” “single office,” “open-plan floor” presets with editable defaults for speed.



B. Visualization



AI recolor preview: Swap wall colors with edge-aware masks, preserve lighting/shadows; before-after slider; exportable to PDF for quotes.



Finish \& sheen simulator: Matte/Eggshell/Satin/Gloss reflectance simulation to set expectations (reduces callbacks).



Accent wall planner: Suggests accent placements using rule-of-thirds and focal points detected in the room.



C. Quote Intelligence



Coverage engine: Computes gallons/liters by substrate + coat count; adjusts for primer needs and brand-specific coverage ranges.



Labor time model: Parametric estimator by surface area, cut-in complexity, height, masking needs, doors/casings count, and condition score.



Multi-option quoting: Good/Better/Best packages (e.g., Standard vs. Premium paint, 1-year vs. 3-year touch-up). One-tap accept per option.



Upsell recommender: AI suggests add-ons (feature walls, cabinet refinishing, ceiling refresh, caulking) based on captured context.



Margin guardrails: Warns when price drops below target gross margin; shows slider of price ↔ probability to win (based on historical close data).



Change-order engine: Mid-job scope changes produce clean addendums with e-sign + updated materials list.



D. Ops \& Workflow



Instant BOM \& shopping list: Auto-generates materials by brand/line; export to CSV/PDF; per-room labels; split by store aisle.



Vendor price sync: Store-specific price lists cached in Firestore; update via CSV upload; app recalculates quotes.



Crew scheduler + capacity check: Drag-and-drop calendar with capacity warnings (crew size, daylight, drying time).



On-site job pack: Print/share a packet with color codes, sheens, room maps, masking notes, substrate warnings, and site contact details.



Time \& task tracker: Simple per-room checklist with start/stop timers; feeds back into estimator to improve accuracy over time.



E. Sales \& Customer Experience



Instant web quote intake: Embeddable widget for homeowners; guides them to snap rooms and select finishes; pushes a draft quote to your dashboard.



Client portal: Approvals, color selections, schedule, payments, warranties; homeowners can comment on rooms (pin-drop notes).



E-sign + deposit: Stripe integration; configurable deposit %; auto-issues invoices and receipts.



Review \& referral nudges: Post-completion flow with deep links to Google Business reviews; referral code generator.



F. Quality, Risk \& Compliance



VOC \& compliance checker: Flags products exceeding client or jurisdictional VOC limits; suggests alternatives.



Safety checklist \& ladder plan: Auto-generates site safety list based on ceiling heights and exterior work; stores signed acknowledgment.



Weather guard (exteriors): Pulls local forecast; warns about temperature/humidity/precipitation windows; reschedule assistant.



G. Intelligence \& Learning



Win-loss learning loop: Tracks accepted vs. rejected quotes; correlates to price, speed, option mix; suggests price bands per neighborhood profile.



Template A/B tests: Iterate on quote layout/emails/SMS; measure open, click, accept.



Cost drift alerts: Notifies when vendor prices or labor costs move enough to warrant template updates.



Tech approach \& stack notes (so we stay aligned)



Next.js (App Router) + Firebase (Auth, Firestore, Storage, Functions).



Framer Motion for micro-interactions; shadcn/ui + Tailwind for a clean, consistent UI; Lucide icons.



React Hook Form + Zod for robust forms and schema validation.



TanStack Query for data fetching/caching.



Stripe for payments; Resend/Postmark for transactional email; Twilio or Vonage for SMS.



Capacitor (by Ionic) is the “web wrapper” you were thinking of—great for shipping the PWA as iOS/Android with native camera/filesystem access.



AI/CV:



Recolor \& segmentation: server-side Functions with a vision model + OpenCV; fall back to client-side Wasm masks for quick previews.



Measurement: plane detection via WebXR/AR + heuristic scaling; or the reference-object approach (paper/A4) when AR isn’t available.



Text models: Gemini for estimations, option sets, upsell ideas, and quote copy.



Free vs. Full (initial idea)



Free: Up to 5 rooms/project, 3 active projects, 1 recolor preview per room, vendor prices manual entry only, standard quote PDF with watermark, no e-sign, no payments, limited SMS.



Full: Unlimited rooms/projects, advanced recolor + segmentation, AR capture \& reference-object measurement, e-sign + deposits, client portal, scheduler, vendor price sync, BOM export, review/referral automations, analytics.



