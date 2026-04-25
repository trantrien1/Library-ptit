from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class LibrarySetting(Base):
    __tablename__ = "library_settings"

    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(80), unique=True, nullable=False, index=True)
    setting_value = Column(Text, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class DigitalResource(Base):
    __tablename__ = "digital_resources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False, default="ebook")
    source_type = Column(String(50), nullable=False, default="internal")
    url = Column(String(500))
    description = Column(Text)
    subjects = Column(String(255), index=True)
    access_level = Column(String(50), nullable=False, default="authenticated")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (UniqueConstraint("user_id", "book_id", name="uq_user_book_recommendation"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(Text)
    score = Column(Float, default=0)
    created_at = Column(DateTime, server_default=func.now())

    book = relationship("Book")


class DiscussionGroup(Base):
    __tablename__ = "discussion_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    slug = Column(String(140), nullable=False, unique=True, index=True)
    topic = Column(String(120), index=True)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_public = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=False)
    status = Column(String(40), default="active")
    rules = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    owner = relationship("User")
    members = relationship("DiscussionGroupMember", back_populates="group", cascade="all, delete-orphan")
    posts = relationship("DiscussionPost", back_populates="group", cascade="all, delete-orphan")

    @property
    def member_count(self) -> int:
        return len([member for member in self.members or [] if member.status == "approved"])

    @property
    def post_count(self) -> int:
        return len([post for post in self.posts or [] if post.status == "active"])


class DiscussionPost(Base):
    __tablename__ = "discussion_posts"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("discussion_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(180), nullable=False)
    content = Column(Text, nullable=False)
    post_type = Column(String(40), default="discussion")
    tags = Column(String(255))
    rating = Column(Integer, nullable=True)
    status = Column(String(40), default="active")
    created_at = Column(DateTime, server_default=func.now())

    group = relationship("DiscussionGroup", back_populates="posts")
    user = relationship("User")
    book = relationship("Book")
    comments = relationship("DiscussionPostComment", back_populates="post", cascade="all, delete-orphan")
    reactions = relationship("DiscussionPostReaction", back_populates="post", cascade="all, delete-orphan")
    saves = relationship("DiscussionPostSave", back_populates="post", cascade="all, delete-orphan")

    @property
    def like_count(self) -> int:
        return len([reaction for reaction in self.reactions or [] if reaction.reaction_type == "like"])

    @property
    def comment_count(self) -> int:
        return len([comment for comment in self.comments or [] if comment.status == "active"])

    @property
    def save_count(self) -> int:
        return len(self.saves or [])


class DiscussionGroupMember(Base):
    __tablename__ = "discussion_group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_discussion_group_member"),)

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("discussion_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(40), default="member")
    status = Column(String(40), default="approved")
    joined_at = Column(DateTime, server_default=func.now())

    group = relationship("DiscussionGroup", back_populates="members")
    user = relationship("User")


class DiscussionPostComment(Base):
    __tablename__ = "discussion_post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("discussion_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    status = Column(String(40), default="active")
    created_at = Column(DateTime, server_default=func.now())

    post = relationship("DiscussionPost", back_populates="comments")
    user = relationship("User")


class DiscussionPostReaction(Base):
    __tablename__ = "discussion_post_reactions"
    __table_args__ = (UniqueConstraint("post_id", "user_id", "reaction_type", name="uq_discussion_post_reaction"),)

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("discussion_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reaction_type = Column(String(40), default="like")
    created_at = Column(DateTime, server_default=func.now())

    post = relationship("DiscussionPost", back_populates="reactions")
    user = relationship("User")


class DiscussionPostSave(Base):
    __tablename__ = "discussion_post_saves"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_discussion_post_save"),)

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("discussion_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    post = relationship("DiscussionPost", back_populates="saves")
    user = relationship("User")


class ReadingChallenge(Base):
    __tablename__ = "reading_challenges"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    description = Column(Text)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    target_books = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())

    participants = relationship("ChallengeParticipant", back_populates="challenge", cascade="all, delete-orphan")

    @property
    def participant_count(self) -> int:
        return len(self.participants or [])

    @property
    def average_progress(self) -> int:
        if not self.participants:
            return 0
        total = sum(participant.progress or 0 for participant in self.participants)
        return int(total / len(self.participants))


class ChallengeParticipant(Base):
    __tablename__ = "challenge_participants"
    __table_args__ = (UniqueConstraint("challenge_id", "user_id", name="uq_challenge_user"),)

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("reading_challenges.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    progress = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    joined_at = Column(DateTime, server_default=func.now())

    challenge = relationship("ReadingChallenge", back_populates="participants")
    user = relationship("User")


class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_code = Column(String(60), nullable=False)
    title = Column(String(120), nullable=False)
    description = Column(Text)
    points = Column(Integer, default=0)
    awarded_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


class BookingResource(Base):
    __tablename__ = "booking_resources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False)
    resource_type = Column(String(50), nullable=False, index=True)
    location = Column(String(160))
    capacity = Column(Integer, default=1)
    status = Column(String(40), default="available")
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    bookings = relationship("Booking", back_populates="resource", cascade="all, delete-orphan")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("booking_resources.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    purpose = Column(Text)
    status = Column(String(40), default="pending")
    created_at = Column(DateTime, server_default=func.now())

    resource = relationship("BookingResource", back_populates="bookings")
    user = relationship("User")


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    page_count = Column(Integer, default=1)
    pickup_code = Column(String(30), nullable=False, index=True)
    status = Column(String(40), default="queued")
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


class LibrarianQuestion(Base):
    __tablename__ = "librarian_questions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    response = Column(Text)
    status = Column(String(40), default="open")
    appointment_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


class Event(Base):
    __tablename__ = "library_events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    event_type = Column(String(60), default="workshop")
    description = Column(Text)
    speaker = Column(String(160))
    format = Column(String(40), default="offline")
    location = Column(String(180))
    online_link = Column(String(500))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    capacity = Column(Integer, default=50)
    registration_deadline = Column(DateTime, nullable=True)
    status = Column(String(40), default="open")
    tags = Column(String(255))
    thumbnail = Column(String(500))
    materials = Column(Text)
    recorded_url = Column(String(500))
    require_checkin = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by])
    registrations = relationship("EventRegistration", back_populates="event", cascade="all, delete-orphan")

    @property
    def registered_count(self) -> int:
        return len([item for item in self.registrations or [] if item.status in {"registered", "checked_in"}])


class EventRegistration(Base):
    __tablename__ = "event_registrations"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_registration_user"),)

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("library_events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(40), default="registered")
    registered_at = Column(DateTime, server_default=func.now())
    checked_in_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    event = relationship("Event", back_populates="registrations")
    user = relationship("User")


class Lab(Base):
    __tablename__ = "labs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text)
    location = Column(String(180))
    capacity = Column(Integer, default=1)
    equipment = Column(Text)
    rules = Column(Text)
    opening_hours = Column(String(180))
    status = Column(String(40), default="available")
    is_bookable = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    bookings = relationship("LabBooking", back_populates="lab", cascade="all, delete-orphan")


class LabBooking(Base):
    __tablename__ = "lab_bookings"

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    purpose = Column(Text)
    participant_count = Column(Integer, default=1)
    status = Column(String(40), default="pending")
    admin_note = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    lab = relationship("Lab", back_populates="bookings")
    user = relationship("User")


class Tutorial(Base):
    __tablename__ = "library_tutorials"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(80), index=True)
    description = Column(Text)
    content_url = Column(String(500))
    duration_minutes = Column(Integer, default=0)
    video_url = Column(String(500))
    thumbnail = Column(String(500))
    topic = Column(String(120), index=True)
    level = Column(String(40), default="beginner")
    view_count = Column(Integer, default=0)
    is_featured = Column(Boolean, default=False)
    status = Column(String(40), default="published")
    attachments = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by])


class NewsPost(Base):
    __tablename__ = "library_news"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(80), default="news")
    news_type = Column(String(40), default="announcement", index=True)
    summary = Column(Text)
    content = Column(Text, nullable=False)
    published = Column(Boolean, default=True)
    status = Column(String(40), default="published", index=True)
    related_target_type = Column(String(40), default="none")
    related_target_id = Column(Integer, nullable=True)
    cta_label = Column(String(120), nullable=True)
    cta_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Feedback(Base):
    __tablename__ = "library_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    feedback_type = Column(String(60), default="general")
    subject = Column(String(180), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(40), default="normal")
    status = Column(String(40), default="new")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User")


class VolunteerDonation(Base):
    __tablename__ = "volunteer_donations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    program_type = Column(String(60), nullable=False)
    title = Column(String(180), nullable=True)
    contact_info = Column(String(180), nullable=True)
    message = Column(Text)
    status = Column(String(40), default="submitted")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User")


class VolunteerProgram(Base):
    __tablename__ = "volunteer_programs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    description = Column(Text)
    location = Column(String(180), nullable=True)
    schedule_note = Column(String(180), nullable=True)
    status = Column(String(40), default="open", index=True)
    related_target_type = Column(String(40), default="none")
    related_target_id = Column(Integer, nullable=True)
    cta_label = Column(String(120), nullable=True)
    cta_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
