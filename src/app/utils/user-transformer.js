const userTransformer = (user) => {
    return {
        _id: user._id,
        profile_image: user.profile_image,
        cover_photo: user.cover_photo,
        name: user.name,
        username: user.username,
        email: user.email,
        bio: user.bio,
        verified: user.verified,
        followers: user.followers,
        following: user.following,
        posts_count: user.posts_count,
        phone_number: user.phone_number,
        unread_notifications_count: user.unread_notifications_count,
        unread_messages_count: user.unread_messages_count,
        account_verification_status: user.account_verification_status,
        website: user.website,
        gender: user.gender,
        birth_date: user.birth_date,
        status: user.status,
        activity_status: user.activity_status,
        blocked_users: user.blocked_users,
        preferred_language: user.preferred_language,
        location: user.location,
        theme_settings: user.theme_settings,
        notification_settings: user.notification_settings,
        created_at: user.created_at,
        updated_at: user.updated_at,
    }
}

module.exports = userTransformer