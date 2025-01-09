function isAuthorizedUser(userId) {
    const authorizedUsers = process.env.AUTHORIZED_USERS?.split(',') || [];
    return authorizedUsers.includes(userId);
}

module.exports = { isAuthorizedUser };