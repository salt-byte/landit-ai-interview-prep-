"""
Seed script — Populate the database with realistic mock data for testing.
Run: cd landit-backend && source venv/bin/activate && python seed_data.py
"""
import asyncio
from datetime import datetime, timedelta
from database import init_db, AsyncSessionLocal
from models.user import UserProfile, Education, Experience, Project
from models.role import TargetRole
from models.interview import InterviewSession, InterviewFeedback, SavedQuestion


async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        # ─── Check if already seeded ─────────────────────────────────────
        from sqlalchemy import select, func
        count = (await db.execute(select(func.count(UserProfile.id)))).scalar()
        if count and count > 0:
            print("⚠️  Database already seeded. Delete landit.db and re-run to reseed.")
            return

        # ─── 1. User Profile ─────────────────────────────────────────────
        profile = UserProfile(
            user_key="default",
            name="Claire Zhang",
            headline="Aspiring Product Manager | AI & Growth",
            bio="Passionate about building AI-powered products that drive user growth. Experienced in data analytics, user research, and cross-functional collaboration.",
            avatar_url="",
            target_roles="Product Manager, Product Analyst, Growth PM",
            location="San Francisco, CA",
            education_level="Master's",
            years_of_experience="2-3",
            interests="AI/ML applications, Growth strategy, User research, Data-driven product development",
            skills_technical="Python, SQL, Tableau, Figma, A/B Testing, Google Analytics",
            skills_product="User Research, PRD Writing, Roadmap Planning, Feature Prioritization, Stakeholder Management",
            skills_communication="Presentation Skills, Cross-functional Collaboration, Technical Writing",
        )
        db.add(profile)
        await db.flush()

        # Education
        edu1 = Education(
            profile_id=profile.id,
            school="Stanford University",
            degree="Master's",
            major="Management Science & Engineering",
            year="2025",
            key_coursework="Machine Learning, Product Design, Data Analytics, Optimization",
            academic_focus="AI-driven product strategy and growth optimization",
            sort_order=0,
        )
        edu2 = Education(
            profile_id=profile.id,
            school="Peking University",
            degree="Bachelor's",
            major="Computer Science",
            year="2023",
            key_coursework="Algorithms, Database Systems, HCI, Statistics",
            academic_focus="Human-computer interaction and data science",
            sort_order=1,
        )
        db.add_all([edu1, edu2])

        # Experience
        exp1 = Experience(
            profile_id=profile.id,
            company="ByteDance",
            role="Product Management Intern",
            type="Internship",
            duration="Jun 2024 - Sep 2024",
            responsibilities="Led user growth experiments for TikTok Creator tools, increasing creator retention by 15%. Designed and shipped an AI-powered content scheduling feature. Collaborated with engineering, data science, and design teams across 3 time zones.",
            sort_order=0,
        )
        exp2 = Experience(
            profile_id=profile.id,
            company="Notion",
            role="Product Analytics Intern",
            type="Internship",
            duration="Jan 2024 - May 2024",
            responsibilities="Built dashboards tracking user engagement metrics for Notion AI features. Conducted user segmentation analysis that informed the Q2 product roadmap. Performed A/B test analysis for 5+ feature launches.",
            sort_order=1,
        )
        db.add_all([exp1, exp2])

        # Projects
        proj1 = Project(
            profile_id=profile.id,
            name="AI Study Buddy",
            context="Stanford CS capstone project",
            role="Product Lead & ML Engineer",
            tools="Python, GPT-4 API, React, Firebase",
            outcome="Built an AI tutoring app used by 200+ students, achieving 4.5/5 satisfaction rating",
            learnings="Learned to balance technical feasibility with user needs in AI product development",
            sort_order=0,
        )
        db.add(proj1)

        # ─── 2. Target Roles ─────────────────────────────────────────────
        role1 = TargetRole(
            user_key="default",
            title="Associate Product Manager",
            company="OpenAI",
            jd="We're looking for an Associate Product Manager to help build the future of AI. You'll work on API products, collaborate with researchers, and drive product strategy. Requirements: 1-3 years PM experience, strong analytical skills, passion for AI/ML, excellent communication skills.",
            team_info="API Products Team",
            company_background="OpenAI is an AI research company focused on building safe AGI.",
            team_background="The API Products team builds developer tools and APIs that power thousands of applications.",
            additional_notes="Focus on developer experience and API usability",
            interview_questions=["How would you improve ChatGPT's user experience?", "Design an API pricing strategy for a new model."],
        )
        role2 = TargetRole(
            user_key="default",
            title="Product Growth Analyst",
            company="TikTok",
            jd="Join TikTok's Growth team to drive user acquisition and retention through data-driven product strategies. Requirements: Strong SQL/Python skills, experience with A/B testing, understanding of growth frameworks, 1-2 years experience in growth or analytics.",
            team_info="Global Growth Team",
            company_background="TikTok is the world's leading short-form video platform.",
            team_background="The Growth team focuses on user acquisition, activation, and retention across markets.",
            additional_notes="Strong emphasis on metrics and experimentation",
            interview_questions=["How would you improve TikTok's user retention?", "Design an experiment to test a new onboarding flow."],
        )
        role3 = TargetRole(
            user_key="default",
            title="Product Marketing Manager",
            company="Notion",
            jd="We need a Product Marketing Manager to drive adoption of Notion AI features. Requirements: 2+ years in product marketing or product management, excellent storytelling skills, experience with B2B SaaS products, data-driven mindset.",
            team_info="Product Marketing Team",
            company_background="Notion is an all-in-one workspace for notes, docs, and project management.",
            team_background="The Product Marketing team drives go-to-market strategy for new features.",
            additional_notes="Focus on AI feature adoption and B2B growth",
            interview_questions=["How would you market Notion AI to enterprise customers?", "Design a launch strategy for a new collaboration feature."],
        )
        db.add_all([role1, role2, role3])
        await db.flush()

        # ─── 3. Interview Sessions + Feedback ────────────────────────────
        now = datetime.utcnow()

        sessions_data = [
            # OpenAI sessions
            {
                "role_id": role1.id, "interviewer_id": "adrian",
                "interviewer_name": "Dr. Adrian Park", 
                "interviewer_avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200",
                "status": "completed", "duration": 1500,
                "overall_rating": "Excellent", "summary": "Outstanding technical depth and product sense.",
                "started_at": now - timedelta(days=3, hours=2),
                "ended_at": now - timedelta(days=3, hours=1, minutes=35),
                "feedback": {
                    "overall_score": 92, "strengths": ["Technical depth", "Product sense", "Vision"],
                    "improvements": ["Could elaborate more on metrics"],
                    "transcript_items": [
                        {"question": "How would you improve ChatGPT's user experience?", "answer": "I'd focus on three areas: 1) conversation continuity — users lose context across sessions, so I'd build a memory feature. 2) output quality signals — add confidence indicators so users know when to verify. 3) workflow integration — deeper hooks into developer tools and productivity apps.", "rating": "Strong", "feedback": "Excellent structured answer with clear prioritization.", "note": ""},
                        {"question": "Design an API pricing strategy for a new model.", "answer": "I'd use a usage-based pricing model with free tier, pay-as-you-go, and enterprise tiers. Key metrics: cost per token, compute utilization, and developer conversion rate. I'd A/B test pricing thresholds to optimize revenue while maintaining developer adoption.", "rating": "Strong", "feedback": "Strong analytical framework. Consider competitive positioning more.", "note": "Remember to mention competitive analysis next time."},
                        {"question": "Tell me about a time you had to make a difficult product trade-off.", "answer": "At ByteDance, we had to choose between shipping a full AI scheduling feature or a simpler version. I advocated for MVP with core scheduling + analytics, which shipped 3 weeks earlier and we iterated based on real usage data. The feature saw 40% adoption in the first month.", "rating": "Strong", "feedback": "Great use of STAR method with quantified results.", "note": ""},
                    ],
                },
            },
            {
                "role_id": role1.id, "interviewer_id": "emma_w",
                "interviewer_name": "Emma Wilson",
                "interviewer_avatar": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=200&h=200",
                "status": "completed", "duration": 1100,
                "overall_rating": "Good", "summary": "Good behavioral answers, but needs more structure.",
                "started_at": now - timedelta(days=8, hours=3),
                "ended_at": now - timedelta(days=8, hours=2, minutes=42),
                "feedback": {
                    "overall_score": 75, "strengths": ["Behavioral answers", "Empathy", "Cultural fit"],
                    "improvements": ["Answer structure", "Quantified impact"],
                    "transcript_items": [
                        {"question": "Tell me about a time you aligned multiple stakeholders with conflicting priorities.", "answer": "I was leading a project to launch a new feature and two teams had different priorities. I set up weekly syncs and created a shared doc to track decisions.", "rating": "Pass", "feedback": "Good example, but could use more specific outcomes and numbers.", "note": "Need to add metrics next time."},
                        {"question": "Describe a product you love and how you'd improve it.", "answer": "I love Notion for its flexibility. I'd improve the mobile experience with better offline support and quicker capture features for on-the-go note taking.", "rating": "Strong", "feedback": "Thoughtful analysis with user-centric improvements.", "note": ""},
                    ],
                },
            },
            # TikTok sessions
            {
                "role_id": role2.id, "interviewer_id": "emma_c",
                "interviewer_name": "Emma Chen",
                "interviewer_avatar": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=200&h=200",
                "status": "completed", "duration": 1080,
                "overall_rating": "Good", "summary": "Strong structure, needs deeper technical metrics.",
                "started_at": now - timedelta(days=2, hours=5),
                "ended_at": now - timedelta(days=2, hours=4, minutes=42),
                "feedback": {
                    "overall_score": 78, "strengths": ["Clear communication", "Good structure", "Analytical thinking"],
                    "improvements": ["More specific metrics", "Better time management"],
                    "transcript_items": [
                        {"question": "Tell me about a time you had to align multiple stakeholders with conflicting priorities.", "answer": "I was leading a project to launch a new creator analytics feature at ByteDance. The engineering team wanted to build a full dashboard, but the design team preferred a simpler widget. I facilitated a workshop where we mapped user needs to technical constraints, and we agreed on a phased approach that satisfied both teams.", "rating": "Strong", "feedback": "Excellent use of STAR method with clear conflict resolution.", "note": "I felt confident here."},
                        {"question": "How would you improve user retention for TikTok?", "answer": "I would focus on the onboarding experience — personalize the For You page faster using watch-time signals from the first 5 minutes. Also, creator-viewer loops: notify viewers when their favorite creators go live.", "rating": "Pass", "feedback": "Good ideas, but could be more data-driven. Mention specific retention metrics.", "note": "Need to mention specific metrics next time like D7 retention rate."},
                    ],
                },
            },
            {
                "role_id": role2.id, "interviewer_id": "alex",
                "interviewer_name": "Alex Morgan",
                "interviewer_avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200",
                "status": "completed", "duration": 900,
                "overall_rating": "Needs Improvement", "summary": "Good energy, but answers lacked depth.",
                "started_at": now - timedelta(days=4, hours=6),
                "ended_at": now - timedelta(days=4, hours=5, minutes=45),
                "feedback": {
                    "overall_score": 58, "strengths": ["Enthusiasm", "Cultural fit"],
                    "improvements": ["Technical depth", "Strategic thinking", "Structured answers"],
                    "transcript_items": [
                        {"question": "Walk me through how you'd design an experiment to test a new onboarding flow.", "answer": "I would create two versions and A/B test them to see which one performs better.", "rating": "Needs improvement", "feedback": "Too vague. Need to specify hypothesis, metrics, sample size, and success criteria.", "note": "Study A/B testing frameworks more carefully."},
                    ],
                },
            },
            {
                "role_id": role2.id, "interviewer_id": "victor",
                "interviewer_name": "Victor Hale",
                "interviewer_avatar": "https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200&h=200",
                "status": "completed", "duration": 1200,
                "overall_rating": "Good", "summary": "Solid performance, good analytical skills.",
                "started_at": now - timedelta(days=5, hours=4),
                "ended_at": now - timedelta(days=5, hours=3, minutes=40),
                "feedback": {
                    "overall_score": 80, "strengths": ["Analytical thinking", "Problem solving", "Data-driven approach"],
                    "improvements": ["Communication clarity"],
                    "transcript_items": [],
                },
            },
            # Notion sessions
            {
                "role_id": role3.id, "interviewer_id": "sophia",
                "interviewer_name": "Sophia Ramirez",
                "interviewer_avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200&h=200",
                "status": "completed", "duration": 1300,
                "overall_rating": "Good", "summary": "Great storytelling, but needs more focus on metrics.",
                "started_at": now - timedelta(days=2, hours=3),
                "ended_at": now - timedelta(days=2, hours=2, minutes=38),
                "feedback": {
                    "overall_score": 82, "strengths": ["Storytelling", "Creativity", "User empathy"],
                    "improvements": ["Metrics focus", "Competitive analysis"],
                    "transcript_items": [
                        {"question": "How would you market Notion AI to enterprise customers?", "answer": "I'd focus on three pillars: 1) ROI storytelling — create case studies showing how Notion AI saves teams 5+ hours/week. 2) Champion program — identify power users within target accounts and give them premium AI features. 3) Integration story — position Notion AI as the connective tissue between existing enterprise tools.", "rating": "Strong", "feedback": "Excellent strategic framework with clear execution plan.", "note": ""},
                        {"question": "What metrics would you track for a product launch?", "answer": "Adoption rate (DAU/MAU of AI features), time-to-value (how quickly users get first insight), NPS delta (before/after), and retention curve comparison.", "rating": "Strong", "feedback": "Great choice of metrics with clear rationale.", "note": ""},
                    ],
                },
            },
            {
                "role_id": role3.id, "interviewer_id": "alex",
                "interviewer_name": "Alex Morgan",
                "interviewer_avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200",
                "status": "completed", "duration": 1000,
                "overall_rating": "Good", "summary": "Decent performance, but lacked specific examples.",
                "started_at": now - timedelta(days=13, hours=5),
                "ended_at": now - timedelta(days=13, hours=4, minutes=43),
                "feedback": {
                    "overall_score": 70, "strengths": ["Communication", "Market awareness"],
                    "improvements": ["Specific examples", "Deeper competitive analysis"],
                    "transcript_items": [],
                },
            },
            {
                "role_id": role3.id, "interviewer_id": "victor",
                "interviewer_name": "Victor Hale",
                "interviewer_avatar": "https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200&h=200",
                "status": "completed", "duration": 1400,
                "overall_rating": "Good", "summary": "Strong strategic thinking, needs tactical execution details.",
                "started_at": now - timedelta(days=18, hours=6),
                "ended_at": now - timedelta(days=18, hours=5, minutes=37),
                "feedback": {
                    "overall_score": 76, "strengths": ["Strategic thinking", "Big picture vision"],
                    "improvements": ["Tactical execution", "Implementation timeline"],
                    "transcript_items": [],
                },
            },
        ]

        for sd in sessions_data:
            fb_data = sd.pop("feedback")
            session = InterviewSession(**sd, user_key="default")
            db.add(session)
            await db.flush()

            feedback = InterviewFeedback(
                session_id=session.id,
                user_key="default",
                overall_score=fb_data["overall_score"],
                strengths=fb_data["strengths"],
                improvements=fb_data["improvements"],
                recommended_actions=[],
                transcript="",
                transcript_items=fb_data.get("transcript_items", []),
                dimension_scores={},
            )
            db.add(feedback)

        # ─── 4. Saved Questions (Question Bank) ──────────────────────────
        questions = [
            # OpenAI questions
            SavedQuestion(user_key="default", role_id=str(role1.id), type="Product Design & Sense",
                question="How would you improve ChatGPT's user experience?",
                answer="Focus on conversation continuity, output quality signals, and workflow integration.",
                source="MOCK_PREP"),
            SavedQuestion(user_key="default", role_id=str(role1.id), type="Strategy & Vision",
                question="Design an API pricing strategy for a new model.",
                answer="Usage-based pricing with free tier, pay-as-you-go, and enterprise tiers.",
                source="MOCK_PREP"),
            SavedQuestion(user_key="default", role_id=str(role1.id), type="Behavioral & Experience",
                question="Tell me about a time you made a difficult product trade-off.",
                answer="At ByteDance, I advocated for MVP approach to AI scheduling feature, shipped 3 weeks earlier with 40% adoption.",
                source="LIVE_INTERVIEW"),
            SavedQuestion(user_key="default", role_id=str(role1.id), type="Analytical & Execution",
                question="How would you measure the success of a developer API product?",
                answer="", source="MOCK_PREP"),
            # TikTok questions
            SavedQuestion(user_key="default", role_id=str(role2.id), type="Behavioral & Experience",
                question="Tell me about a time you aligned multiple stakeholders with conflicting priorities.",
                answer="Led a creator analytics feature at ByteDance, facilitated workshop to map user needs to constraints, agreed on phased approach.",
                source="LIVE_INTERVIEW"),
            SavedQuestion(user_key="default", role_id=str(role2.id), type="Product Design & Sense",
                question="How would you improve user retention for TikTok?",
                answer="Personalize For You page faster using watch-time signals; create creator-viewer notification loops.",
                source="LIVE_INTERVIEW"),
            SavedQuestion(user_key="default", role_id=str(role2.id), type="Analytical & Execution",
                question="Walk me through how you'd design an experiment to test a new onboarding flow.",
                answer="", source="MOCK_PREP"),
            SavedQuestion(user_key="default", role_id=str(role2.id), type="Strategy & Vision",
                question="How would you expand TikTok's creator monetization?",
                answer="Three-tier approach: 1) Enhanced creator fund with performance bonuses, 2) Brand marketplace for sponsored content, 3) Subscription model for exclusive creator content.",
                source="MOCK_PREP"),
            # Notion questions
            SavedQuestion(user_key="default", role_id=str(role3.id), type="Strategy & Vision",
                question="How would you market Notion AI to enterprise customers?",
                answer="ROI storytelling with case studies, champion program for power users, integration positioning as connective tissue.",
                source="LIVE_INTERVIEW"),
            SavedQuestion(user_key="default", role_id=str(role3.id), type="Analytical & Execution",
                question="What metrics would you track for a product launch?",
                answer="Adoption rate (DAU/MAU), time-to-value, NPS delta, retention curve comparison.",
                source="LIVE_INTERVIEW"),
            SavedQuestion(user_key="default", role_id=str(role3.id), type="Product Design & Sense",
                question="How would you redesign Notion's onboarding for non-technical users?",
                answer="", source="MOCK_PREP"),
        ]
        db.add_all(questions)

        await db.commit()
        print("✅ Seed data created successfully!")
        print(f"   • 1 User Profile (Claire Zhang)")
        print(f"   • 3 Target Roles (OpenAI, TikTok, Notion)")
        print(f"   • {len(sessions_data)} Interview Sessions with feedback")
        print(f"   • {len(questions)} Saved Questions")


if __name__ == "__main__":
    asyncio.run(seed())
