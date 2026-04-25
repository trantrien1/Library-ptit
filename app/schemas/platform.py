from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .book import BookResponse
from .user import UserResponse


class DigitalResourceBase(BaseModel):
    title: str
    resource_type: str = "ebook"
    source_type: str = "internal"
    url: Optional[str] = None
    description: Optional[str] = None
    subjects: Optional[str] = None
    access_level: str = "authenticated"


class DigitalResourceCreate(DigitalResourceBase):
    pass


class DigitalResourceOut(DigitalResourceBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecommendationOut(BaseModel):
    id: int
    reason: Optional[str] = None
    score: float = 0
    book: Optional[BookResponse] = None

    class Config:
        from_attributes = True


class DiscussionGroupCreate(BaseModel):
    name: str
    slug: str
    topic: Optional[str] = None
    description: Optional[str] = None
    is_public: bool = True
    requires_approval: bool = False
    rules: Optional[str] = None


class DiscussionGroupOut(DiscussionGroupCreate):
    id: int
    owner_id: Optional[int] = None
    created_at: datetime
    member_count: int = 0
    post_count: int = 0
    is_member: bool = False
    membership_status: Optional[str] = None
    group_role: Optional[str] = None
    is_group_admin: bool = False
    status: str = "active"

    class Config:
        from_attributes = True


class DiscussionPostCreate(BaseModel):
    group_id: int
    title: str
    content: str
    book_id: Optional[int] = None
    post_type: str = "discussion"
    tags: Optional[str] = None
    rating: Optional[int] = None


class DiscussionPostUpdate(BaseModel):
    group_id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None
    book_id: Optional[int] = None
    post_type: Optional[str] = None
    tags: Optional[str] = None
    rating: Optional[int] = None


class DiscussionPostCommentCreate(BaseModel):
    content: str


class DiscussionPostCommentOut(BaseModel):
    id: int
    post_id: int
    user_id: int
    content: str
    status: str = "active"
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class DiscussionPostOut(BaseModel):
    id: int
    group_id: int
    user_id: int
    book_id: Optional[int] = None
    title: str
    content: str
    post_type: str
    tags: Optional[str] = None
    rating: Optional[int] = None
    status: str = "active"
    created_at: datetime
    user: Optional[UserResponse] = None
    book: Optional[BookResponse] = None
    group: Optional[DiscussionGroupOut] = None
    like_count: int = 0
    comment_count: int = 0
    save_count: int = 0
    liked_by_me: bool = False
    saved_by_me: bool = False
    is_owner: bool = False
    can_edit: bool = False
    can_delete: bool = False

    class Config:
        from_attributes = True


class ReadingChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    target_books: int = 1


class ReadingChallengeOut(ReadingChallengeCreate):
    id: int
    created_at: datetime
    participant_count: int = 0
    average_progress: int = 0

    class Config:
        from_attributes = True


class ChallengeParticipantOut(BaseModel):
    id: int
    challenge_id: int
    user_id: int
    progress: int
    completed: bool
    joined_at: datetime

    class Config:
        from_attributes = True


class UserBadgeOut(BaseModel):
    id: int
    badge_code: str
    title: str
    description: Optional[str] = None
    points: int = 0
    awarded_at: datetime

    class Config:
        from_attributes = True


class SocialActionOut(BaseModel):
    active: bool
    like_count: int = 0
    save_count: int = 0


class CommunityLeaderboardItem(BaseModel):
    user_id: int
    full_name: Optional[str] = None
    username: str
    community_points: int
    post_count: int = 0
    comment_count: int = 0
    like_count: int = 0
    badge_count: int = 0


class SocialHubSidebar(BaseModel):
    featured_groups: list[DiscussionGroupOut]
    active_challenges: list[ReadingChallengeOut]
    leaderboard: list[CommunityLeaderboardItem]
    my_badges: list[UserBadgeOut]


class DiscussionGroupMemberOut(BaseModel):
    id: int
    group_id: int
    user_id: int
    role: str
    status: str
    joined_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class BookingResourceCreate(BaseModel):
    name: str
    resource_type: str
    location: Optional[str] = None
    capacity: int = 1
    status: str = "available"
    description: Optional[str] = None


class BookingResourceOut(BookingResourceCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BookingCreate(BaseModel):
    resource_id: int
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None


class BookingOut(BaseModel):
    id: int
    resource_id: int
    user_id: int
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None
    status: str
    created_at: datetime
    resource: Optional[BookingResourceOut] = None

    class Config:
        from_attributes = True


class PrintJobCreate(BaseModel):
    file_name: str
    page_count: int = 1


class PrintJobOut(PrintJobCreate):
    id: int
    user_id: int
    pickup_code: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class LibrarianQuestionCreate(BaseModel):
    question: str
    appointment_at: Optional[datetime] = None


class LibrarianQuestionOut(BaseModel):
    id: int
    user_id: int
    question: str
    response: Optional[str] = None
    status: str
    appointment_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EventCreate(BaseModel):
    title: str
    event_type: str = "workshop"
    description: Optional[str] = None
    speaker: Optional[str] = None
    format: str = "offline"
    location: Optional[str] = None
    online_link: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    capacity: int = 50
    registration_deadline: Optional[datetime] = None
    status: str = "open"
    tags: Optional[str] = None
    thumbnail: Optional[str] = None
    materials: Optional[str] = None
    recorded_url: Optional[str] = None
    require_checkin: bool = True


class EventUpdate(BaseModel):
    title: Optional[str] = None
    event_type: Optional[str] = None
    description: Optional[str] = None
    speaker: Optional[str] = None
    format: Optional[str] = None
    location: Optional[str] = None
    online_link: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    capacity: Optional[int] = None
    registration_deadline: Optional[datetime] = None
    status: Optional[str] = None
    tags: Optional[str] = None
    thumbnail: Optional[str] = None
    materials: Optional[str] = None
    recorded_url: Optional[str] = None
    require_checkin: Optional[bool] = None


class EventRegistrationOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    status: str
    registered_at: datetime
    checked_in_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class EventOut(EventCreate):
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    registered_count: int = 0
    registered_by_me: bool = False
    my_registration: Optional[EventRegistrationOut] = None

    class Config:
        from_attributes = True


class TutorialCreate(BaseModel):
    title: str
    category: Optional[str] = None
    description: Optional[str] = None
    content_url: Optional[str] = None
    duration_minutes: int = 0
    video_url: Optional[str] = None
    thumbnail: Optional[str] = None
    topic: Optional[str] = None
    level: str = "beginner"
    is_featured: bool = False
    status: str = "published"
    attachments: Optional[str] = None


class TutorialUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    content_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    video_url: Optional[str] = None
    thumbnail: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    is_featured: Optional[bool] = None
    status: Optional[str] = None
    attachments: Optional[str] = None


class TutorialOut(TutorialCreate):
    id: int
    view_count: int = 0
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LabCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    capacity: int = 1
    equipment: Optional[str] = None
    rules: Optional[str] = None
    opening_hours: Optional[str] = None
    status: str = "available"
    is_bookable: bool = True


class LabUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    capacity: Optional[int] = None
    equipment: Optional[str] = None
    rules: Optional[str] = None
    opening_hours: Optional[str] = None
    status: Optional[str] = None
    is_bookable: Optional[bool] = None


class LabOut(LabCreate):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LabBookingCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None
    participant_count: int = 1


class LabBookingOut(BaseModel):
    id: int
    lab_id: int
    user_id: int
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None
    participant_count: int = 1
    status: str
    admin_note: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    lab: Optional[LabOut] = None
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class AdminNoteIn(BaseModel):
    admin_note: Optional[str] = None


class EventCheckinIn(BaseModel):
    user_id: Optional[int] = None
    registration_id: Optional[int] = None


class NewsPostCreate(BaseModel):
    title: str
    category: str = "news"
    news_type: str = "announcement"
    summary: Optional[str] = None
    content: str
    published: bool = True
    status: str = "published"
    related_target_type: str = "none"
    related_target_id: Optional[int] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None


class NewsPostUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    news_type: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    published: Optional[bool] = None
    status: Optional[str] = None
    related_target_type: Optional[str] = None
    related_target_id: Optional[int] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None


class NewsPostOut(NewsPostCreate):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FeedbackCreate(BaseModel):
    feedback_type: str = "general"
    subject: str
    message: str
    priority: str = "normal"


class FeedbackOut(FeedbackCreate):
    id: int
    user_id: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class VolunteerDonationCreate(BaseModel):
    program_type: str
    title: Optional[str] = None
    contact_info: Optional[str] = None
    message: Optional[str] = None


class VolunteerDonationOut(VolunteerDonationCreate):
    id: int
    user_id: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class VolunteerProgramCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    schedule_note: Optional[str] = None
    status: str = "open"
    related_target_type: str = "none"
    related_target_id: Optional[int] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None


class VolunteerProgramUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    schedule_note: Optional[str] = None
    status: Optional[str] = None
    related_target_type: Optional[str] = None
    related_target_id: Optional[int] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None


class VolunteerProgramOut(VolunteerProgramCreate):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FeedbackStatusUpdate(BaseModel):
    status: str


class DonationStatusUpdate(BaseModel):
    status: str


class LibraryInfoOut(BaseModel):
    locations: list[dict]
    opening_hours: list[dict]
    rules: list[str]
    today_status: str


class LibraryInfoUpdate(BaseModel):
    locations: Optional[list[dict]] = None
    opening_hours: Optional[list[dict]] = None
    rules: Optional[list[str]] = None


class PlatformOverview(BaseModel):
    digital_resources: int
    discussion_groups: int
    discussion_posts: int
    active_challenges: int
    booking_resources: int
    upcoming_events: int
    news_posts: int
