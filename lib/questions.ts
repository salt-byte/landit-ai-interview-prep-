/**
 * PM Interview Question Bank — 97 questions across 4 types.
 * Source: lib/M_Interview_Question_Bank.md
 *
 * Company names in questions are placeholders using [COMPANY].
 * Call substituteCompany() at render time to swap in the candidate's target company.
 */

export type QuestionTypeId = 'behavioral' | 'product' | 'analytical' | 'strategy';

// Well-known company names that may appear in question text and should be substituted.
const KNOWN_COMPANIES = [
  'TikTok', 'TikTok Shop', 'Instagram', 'Meta', 'Facebook',
  'Google', 'YouTube', 'Google Maps', 'Google Calendar',
  'Netflix', 'Spotify', 'Airbnb', 'Uber', 'Lyft',
  'Amazon', 'Apple', 'Slack', 'Notion', 'LinkedIn',
  'Shopify', 'Stripe', 'Atlassian', 'OpenAI', 'Canva', 'Adobe',
  'DoorDash', 'Hinge', 'Bumble', 'WhatsApp', 'Twitter', 'X',
  'Salesforce', 'Fitbit', 'Booking',
];

/**
 * Replace well-known company names in a question with the candidate's target company.
 * Preserves product/platform context where possible.
 */
export function substituteCompany(question: string, targetCompany: string): string {
  if (!targetCompany || targetCompany.toLowerCase() === 'the company') return question;

  let result = question;

  // Sort by length descending so longer names (e.g. "TikTok Shop") match before shorter ("TikTok")
  const sorted = [...KNOWN_COMPANIES].sort((a, b) => b.length - a.length);

  for (const name of sorted) {
    // Only replace if it's a whole word / not already the target company
    if (name.toLowerCase() === targetCompany.toLowerCase()) continue;
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    if (regex.test(result)) {
      result = result.replace(new RegExp(`\\b${name}\\b`, 'g'), targetCompany);
    }
  }

  return result;
}

/**
 * Pick `count` random questions from the pool without repetition.
 */
function sample<T>(pool: T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Build a 9-question list (the 10th is always the self-intro) from the selected
 * question types, with company names substituted.
 *
 * If multiple types are selected, questions are evenly distributed across types
 * then filled from remaining if needed.
 */
export function buildActiveQuestions(
  selectedTypes: QuestionTypeId[],
  targetCompany: string,
  total = 9,
): string[] {
  if (selectedTypes.length === 0) selectedTypes = ['behavioral'];

  const perType = Math.ceil(total / selectedTypes.length);

  let picked: string[] = [];
  for (const type of selectedTypes) {
    const pool = QUESTIONS_BY_TYPE[type] ?? [];
    picked.push(...sample(pool, perType));
  }

  // Trim to exact count, shuffle again for variety
  picked = picked.sort(() => Math.random() - 0.5).slice(0, total);

  return picked.map(q => substituteCompany(q, targetCompany));
}

// ─────────────────────────────────────────────────────────────────────────────
// Question pools by type
// ─────────────────────────────────────────────────────────────────────────────

export const QUESTIONS_BY_TYPE: Record<QuestionTypeId, string[]> = {

  // ── Part 1: Behavioral & Experience ────────────────────────────────────────
  behavioral: [
    // Decision-Making Under Uncertainty
    "Tell me about a time you had to make a product decision with incomplete data. What did you decide, and what would have changed your mind?",
    "Describe a time you killed a feature or project that your team had already invested significant effort in. How did you make that call?",
    "Tell me about a time you launched something that underperformed. What did you learn, and what would you do differently?",

    // Prioritization & Trade-offs
    "Your engineering team has capacity for one project this quarter. Option A improves retention by an estimated 5% but takes the full quarter. Option B ships three smaller features that Sales has been requesting for months. Walk me through how you decide.",
    "You have three bugs reported this morning: one affects 1% of users but causes data loss, one affects 30% of users but is cosmetic, and one blocks a partnership launch next week. You can only fix two today. Which two and why?",
    "Tell me about a time you said no to a stakeholder who outranked you. What was the ask, why did you push back, and what happened?",

    // Cross-Functional Collaboration
    "Tell me about a time you and your engineering lead disagreed on the scope of a project. How did you resolve it, and were you happy with the outcome?",
    "Describe a situation where a design decision conflicted with what the data was telling you. What did you do?",

    // Influence Without Authority
    "Tell me about a time you needed to get buy-in from a team that didn't report to you and had no incentive to help. How did you do it?",
    "You're a new PM joining a team that's been running without a PM for six months. Engineers have been setting their own priorities. How do you earn trust without disrupting their momentum?",

    // Ownership & Accountability
    "Tell me about a project where the outcome was a failure and you were the one accountable. Not your team, not circumstances — you. What was your mistake?",
    "Describe a time you inherited someone else's mess — a broken feature, a mismanaged project, a toxic team dynamic. What did you do in the first two weeks?",
    "Tell me about a time you were wrong about a user need. How did you find out, and what did you do with that information?",

    // Speed vs. Quality
    "Describe a time you shipped something you knew wasn't perfect because speed mattered more. How did you decide what 'good enough' meant?",
    "Tell me about a time you chose to slow down a project when the rest of the team wanted to move fast. What did you see that they didn't?",
    "You're two days from launch and your designer wants to redo the onboarding flow. Engineering says it's a one-week delay. The current flow tests fine but isn't great. What do you do?",

    // Managing Up & Sideways
    "Tell me about a time your manager gave you a directive you disagreed with. How did you handle it?",
    "Describe a situation where you had to deliver bad news to leadership — a missed deadline, a failed experiment, a wrong bet. How did you frame it?",
    "You discover that a peer PM's project is going to negatively impact your product's key metric. They don't realize it. What do you do?",

    // Ambiguity & Scrappiness
    "Tell me about a time you started a project with zero documentation, no clear requirements, and a vague mandate. How did you create clarity?",
    "Describe a time you had to validate a product idea with no budget for user research. What did you do?",
    "You join a new team and realize the product roadmap was built on assumptions no one has validated. What do you do?",
  ],

  // ── Part 2: Product Design & Sense ─────────────────────────────────────────
  product: [
    // Design From Scratch
    "Design a feature that helps first-time hosts set their pricing on a marketplace platform. You have one engineer and four weeks.",
    "Help small businesses create their first ad in under 5 minutes on your platform. Design the onboarding flow for a user who has never run a digital ad before.",
    "Design a grocery delivery app for elderly users who are not comfortable with smartphones. Walk me through your top three design decisions.",
    "Design a feature for a maps product that helps tourists decide where to eat in a city they've never been to. You cannot use ratings or reviews.",
    "Design a job search experience that works for people who are currently employed and don't want their employer to know they're looking.",
    "Design a feature that helps a group of 5 friends choose a playlist for a road trip when everyone has different taste.",
    "Design a checkout experience for an e-commerce app where 40% of users abandon at the payment step. You can change one thing. What is it?",

    // Improve an Existing Product
    "Pick a product you use daily that frustrates you. What's the single highest-impact change you'd make, and how would you measure if it worked?",
    "Short-video engagement is flat quarter over quarter on your platform. You can either improve the recommendation algorithm or redesign the creation tools. You can only invest in one this half. Which one?",
    "Watch time on your video platform is up 10% but creator uploads are down 15%. What's happening, and what would you do?",
    "A threading feature is widely used but widely disliked. Users say it feels like a 'black hole.' How would you fix threads without removing them?",
    "Your calendar product has hundreds of millions of users but most only use it for meetings. Design a feature that makes it useful for personal lives.",
    "Your 'Continue Watching' row is the most-used feature but users say it feels like a guilt trip. How would you redesign it?",
    "ETAs for your service are wrong 30% of the time but users trust your product more than competitors. Why might that be, and should you fix accuracy or preserve perception?",

    // Product Trade-offs
    "Users want end-to-end encryption in your messaging product, but trust & safety says it will make harassment detection nearly impossible. How do you think about this trade-off?",
    "Your e-commerce app can show 'most popular' products (higher conversion) or 'most relevant' products (higher satisfaction, lower immediate conversion). Which do you default to?",
    "User research says people love a proposed social feed. An A/B test shows engagement drops 20%. Ship or kill?",

    // User Empathy, Edge Cases & Sensitive Design
    "You're building scheduled messages for a messaging app. What's the most important edge case to design for?",
    "Your app wants a 'quiet mode' option. How do you design it without making service providers feel rated on personality?",
    "Design a feature that reduces negative mental health impact on teenagers without significantly reducing engagement.",
    "Your health tracking app shows a user's data trend that suggests a serious condition. How do you surface this information responsibly?",

    // Simplification & Removal
    "Your product has 12 features. 3 are used by 90% of users, 5 by 20%, 4 by less than 3%. How do you decide what to remove, and how do you handle the 3% who rely on a low-usage feature?",
    "You're redesigning a settings page that has 47 options. Goal: reduce to 10 without user backlash. Walk me through your approach.",
    "Pick any widely-used product and identify one feature you would cut entirely. Defend your choice.",
    "A competitor's product is simpler than yours and growing faster. What would you remove from your product to compete?",
  ],

  // ── Part 3: Analytical & Execution ─────────────────────────────────────────
  analytical: [
    // Metrics Definition & Selection
    "You just launched an AI tool at your company. It's been live one month. What's the single most important metric you're watching, and why that one over everything else?",
    "Your north star is DAU. A new feature increases DAU by 8% but decreases revenue per user by 3%. Is this a win?",
    "You're choosing between conversion rate and revenue per session for a new checkout flow. They point in different directions. Which do you optimize for, and when would you switch?",
    "Leadership wants 'time spent' as the north star metric. You disagree. What metric would you propose instead, and why?",
    "Your team is launching a trust & safety feature. How do you measure success when the ideal outcome is something not happening?",
    "Power users are 5% of your base but generate 50% of revenue. Casual users are the other 95% of users but also generate 50% of revenue. Leadership wants one unified metric. Is that possible, and is it a good idea?",
    "Your experiment's guardrail metric (support tickets) crossed the threshold, but your primary metric (conversion) improved significantly. Do you ship?",

    // Root Cause Analysis & Data Interpretation
    "Your app's DAU dropped 8% week over week. What's your first question before looking at any dashboard?",
    "Cancellation rate jumped 15% in one city. Supply is unchanged. Prices are unchanged. What are your top three hypotheses?",
    "Free-to-paid conversion rate went from 3% to 5%, but total paid users decreased. How is this possible, and what does it tell you?",
    "Average order value is up 20%, but total orders are down 10%. Is this good or bad?",
    "Your NPS is 72 (excellent) but monthly churn is 8% (terrible). How do both coexist?",
    "After a new release, crash rate dropped from 2% to 0.5% — but user complaints about stability increased. What's going on?",
    "Searches for 'return policy' spiked 300% this week. No policy changes were made. What do you investigate?",
    "Average transaction value has been increasing steadily for 6 months. Name three scenarios where this is actually a warning sign.",
    "An A/B test shows +3% overall, but desktop shows +8% and mobile shows -2%. What do you do?",

    // Estimation, Sizing & Prioritization
    "How many coffee shops in the US could benefit from an AI playlist product? Walk me through your estimation.",
    "Build in-house (8 weeks, 3 engineers) or buy a third-party solution ($50K/year). How do you frame this decision?",
    "You have 30 feature requests and engineering can ship 5 this quarter. No stakeholder will deprioritize. How do you choose the 5 and say no to the 25?",
    "How do you think about the right mix of revenue features, tech debt, and UX improvements on a roadmap? Does the ratio change over time?",
    "A high-profile customer threatens to churn unless you build their feature in 4 weeks. Building it derails your sprint. How do you handle this?",

    // Experimentation & Launch
    "QA found a bug affecting 2% of users in a non-critical flow. Fixing it delays launch two weeks. Ship or delay?",
    "An A/B test shows 2% CTR improvement, but complaints in the test group tripled. What do you do?",
    "You shipped a feature and engagement is up 12%, but support tickets are up 40%. Keep, iterate, or roll back?",
    "You want to run an A/B test but only have 500 DAU. How do you validate your hypothesis?",
    "An experiment shows neutral results after 4 weeks. Your team wants to end it. Should you?",
    "During a phased rollout, everything is fine at 10%, but performance degrades at 50%. What's your immediate action?",
    "A feature is performing well in the US but poorly in Japan. Same product, same code. What do you investigate?",
  ],

  // ── Part 4: Strategy & Vision ───────────────────────────────────────────────
  strategy: [
    // Market Entry & Expansion
    "You're choosing between launching in a market with the most users but lowest average order value vs. a smaller market with 3x higher AOV. Which do you launch first, and why?",
    "Your B2B SaaS dominates US mid-market. Expand upmarket to enterprise or geographically to a new region? Each takes a year. How do you decide?",

    // Competitive Response
    "A competitor just launched a feature your team could copy in 8 weeks. Should you? What's your decision framework?",
    "A competitor dropped fees to zero, VC-subsidized, and is gaining share fast. What's your response?",
    "You run a profitable but slow-growing product. A new competitor is growing 5x faster by undercutting on price. What do you do?",

    // Platform & Ecosystem
    "Should your platform build its own payment system or continue using third-party providers? How do you evaluate this trade-off?",
    "You have hundreds of millions of users, most on a free tier. Do you push to convert free users to premium, or build new revenue streams for free users?",
    "A startup wants to build on your API. They're small now but could be a competitor in 3 years. Do you let them on the platform?",
    "You're launching a first-party feature that competes directly with the most popular third-party app in your ecosystem. How do you handle this?",
    "A major distribution partner wants a feature only their users see. It's a reasonable feature but sets a customization precedent. Do you build it?",

    // Business Model & Monetization
    "Your core product is free and ad-supported. The CEO asks you to explore subscriptions. What's the first thing you need to figure out before designing pricing?",
    "Your B2C app has 50M users but monetizes poorly. A PE firm suggests cutting features to improve margins. What do you advise the CEO?",

    // Product Vision & Roadmap
    "AI generates content in your product category at near-zero cost. Is this an existential threat or an opportunity? What do you build in the next 18 months?",
    "Your product is #3 in a market dominated by two incumbents. You can't outspend them. What's your 18-month strategy?",
    "Two roadmap options: (A) 6 incremental improvements with 15% expected revenue uplift, or (B) one big bet with a 30% chance of 100% uplift but 70% chance of zero. Which do you choose and why?",
    "Your team has been building a feature for 4 months. New data suggests the problem doesn't exist at scale. The feature is 80% done. What do you do?",

    // Long-term Bets & Disruption
    "What's the biggest threat to your target company's core business in the next five years? What would you build today to address it?",
    "New regulation requires showing users their screen time and nudging them to take breaks. Engagement will drop 10–15%. How do you pitch this to leadership as an opportunity?",
    "Voice interfaces have been 'the next big thing' for 10 years. What would need to change for voice to become primary? Would you bet on it?",
    "AR/VR headsets are improving fast but adoption is niche. When is the right time to invest seriously? How do you know if you're too early?",
    "Autonomous technology is transforming a core industry. If you're PM at your target company, what do you build in the next 5 years to stay ahead?",
    "A major tech platform approaches your company wanting to integrate your product into their ecosystem. They offer 100M users overnight but control the UX and take 30% of revenue. Do you accept?",
    "A large acquirer offers a premium to buy your product. Your team wants to stay independent. How do you think through this decision?",
  ],
};
