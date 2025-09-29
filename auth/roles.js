const ROLES = Object.freeze({
  ADMIN: 'admin',
  PARTNER: 'partner',
  CONTRIBUTOR: 'contributor',
});

const ROLE_HIERARCHY = [ROLES.CONTRIBUTOR, ROLES.PARTNER, ROLES.ADMIN];

function assertRole(role) {
  if (!ROLE_HIERARCHY.includes(role)) {
    throw new Error(`Unknown Vaultfire role: ${role}`);
  }
}

function hasRequiredRole(userRole, requiredRoles = []) {
  if (!requiredRoles.length) {
    return true;
  }

  assertRole(userRole);
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  return requiredRoles.some((role) => {
    assertRole(role);
    return userIndex >= ROLE_HIERARCHY.indexOf(role);
  });
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  assertRole,
  hasRequiredRole,
};
