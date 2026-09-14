// src/middleware/crm.permissions.js

const ADMIN_ROLES = ["super_admin", "admin", "hr_manager"];
const MANAGER_ROLES = [
  "super_admin",
  "admin",
  "hr_manager",
  "dept_manager",
  "project_manager",
  "line_manager",
];

function isAdmin(user) {
  return user && ADMIN_ROLES.includes(user.role);
}
function isManager(user) {
  return user && MANAGER_ROLES.includes(user.role);
}

/**
 * Can this user see/edit this CRM record?
 *  - admins: full access
 *  - managers: full access (team scope is enforced in queries)
 *  - everyone else: only records they own
 */
function canAccessRecord(user, record) {
  if (!user || !record) return false;
  if (isAdmin(user) || isManager(user)) return true;

  const ownerId =
    typeof record.owner === "object" && record.owner
      ? record.owner._id?.toString()
      : record.owner?.toString();

  const assignedRepId =
    typeof record.assignedRep === "object" && record.assignedRep
      ? record.assignedRep._id?.toString()
      : record.assignedRep?.toString();

  const uid = user._id.toString();
  return ownerId === uid || assignedRepId === uid;
}

/**
 * Returns a Mongo filter that limits results based on role.
 *  - admins/managers: {} (no restriction)
 *  - everyone else: { owner: user._id }
 */
function scopeFilter(user, ownerField = "owner") {
  if (isAdmin(user) || isManager(user)) return {};
  return { [ownerField]: user._id };
}

module.exports = { isAdmin, isManager, canAccessRecord, scopeFilter };