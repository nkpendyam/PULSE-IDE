//! Role-Based Access Control (RBAC)
//! 
//! Permission system for managing user capabilities
//! Based on industry best practices for IDE collaboration

use crate::auth::{UserRole, Permission};

/// Check if a role has a specific permission
pub fn has_permission(role: &UserRole, permission: &Permission) -> bool {
    match role {
        UserRole::Owner => true, // Owner has all permissions
        UserRole::Admin => match permission {
            Permission::AdminAccess => true,
            Permission::ProjectSettings => true,
            Permission::CollaboratorInvite => true,
            Permission::CollaboratorRemove => true,
            Permission::ExtensionManage => true,
            Permission::AIAccess => true,
            Permission::TerminalExecute => true,
            Permission::FileDelete => true,
            Permission::FileWrite => true,
            Permission::FileRead => true,
        },
        UserRole::Editor => match permission {
            Permission::FileRead => true,
            Permission::FileWrite => true,
            Permission::FileDelete => true,
            Permission::TerminalExecute => true,
            Permission::AIAccess => true,
            Permission::ExtensionManage => false,
            Permission::CollaboratorInvite => false,
            Permission::CollaboratorRemove => false,
            Permission::ProjectSettings => false,
            Permission::AdminAccess => false,
        },
        UserRole::Viewer => match permission {
            Permission::FileRead => true,
            Permission::AIAccess => true,
            Permission::FileWrite => false,
            Permission::FileDelete => false,
            Permission::TerminalExecute => false,
            Permission::ExtensionManage => false,
            Permission::CollaboratorInvite => false,
            Permission::CollaboratorRemove => false,
            Permission::ProjectSettings => false,
            Permission::AdminAccess => false,
        },
        UserRole::Guest => match permission {
            Permission::FileRead => true,
            Permission::FileWrite => false,
            Permission::FileDelete => false,
            Permission::TerminalExecute => false,
            Permission::ExtensionManage => false,
            Permission::CollaboratorInvite => false,
            Permission::CollaboratorRemove => false,
            Permission::ProjectSettings => false,
            Permission::AIAccess => false,
            Permission::AdminAccess => false,
        },
    }
}

/// Get all permissions for a role
pub fn get_permissions(role: &UserRole) -> Vec<Permission> {
    use Permission::*;
    
    match role {
        UserRole::Owner => vec![
            FileRead, FileWrite, FileDelete, TerminalExecute,
            ExtensionManage, CollaboratorInvite, CollaboratorRemove,
            ProjectSettings, AIAccess, AdminAccess,
        ],
        UserRole::Admin => vec![
            FileRead, FileWrite, FileDelete, TerminalExecute,
            ExtensionManage, CollaboratorInvite, CollaboratorRemove,
            ProjectSettings, AIAccess, AdminAccess,
        ],
        UserRole::Editor => vec![
            FileRead, FileWrite, FileDelete, TerminalExecute, AIAccess,
        ],
        UserRole::Viewer => vec![FileRead, AIAccess],
        UserRole::Guest => vec![FileRead],
    }
}

/// Get role display name
pub fn role_display_name(role: &UserRole) -> &'static str {
    match role {
        UserRole::Owner => "Owner",
        UserRole::Admin => "Admin",
        UserRole::Editor => "Editor",
        UserRole::Viewer => "Viewer",
        UserRole::Guest => "Guest",
    }
}

/// Get role description
pub fn role_description(role: &UserRole) -> &'static str {
    match role {
        UserRole::Owner => "Full control over the project and all collaborators",
        UserRole::Admin => "Can manage collaborators, extensions, and project settings",
        UserRole::Editor => "Can edit files and use terminal and AI features",
        UserRole::Viewer => "Can view files and use AI assistance",
        UserRole::Guest => "Read-only access to project files",
    }
}

/// Permission check result with reason
#[derive(Debug, Clone)]
pub struct PermissionCheck {
    pub allowed: bool,
    pub reason: String,
}

impl PermissionCheck {
    pub fn allowed() -> Self {
        Self {
            allowed: true,
            reason: "Permission granted".to_string(),
        }
    }

    pub fn denied(reason: &str) -> Self {
        Self {
            allowed: false,
            reason: reason.to_string(),
        }
    }
}

/// Check permission with detailed result
pub fn check_permission(role: &UserRole, permission: &Permission) -> PermissionCheck {
    if has_permission(role, permission) {
        PermissionCheck::allowed()
    } else {
        PermissionCheck::denied(&format!(
            "Role '{}' does not have permission '{}'",
            role_display_name(role),
            permission_name(permission)
        ))
    }
}

/// Get permission display name
pub fn permission_name(permission: &Permission) -> &'static str {
    match permission {
        Permission::FileRead => "Read Files",
        Permission::FileWrite => "Write Files",
        Permission::FileDelete => "Delete Files",
        Permission::TerminalExecute => "Execute Terminal Commands",
        Permission::ExtensionManage => "Manage Extensions",
        Permission::CollaboratorInvite => "Invite Collaborators",
        Permission::CollaboratorRemove => "Remove Collaborators",
        Permission::ProjectSettings => "Modify Project Settings",
        Permission::AIAccess => "Access AI Features",
        Permission::AdminAccess => "Access Admin Panel",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_owner_has_all_permissions() {
        let permissions = get_permissions(&UserRole::Owner);
        assert_eq!(permissions.len(), 10);
    }

    #[test]
    fn test_viewer_permissions() {
        assert!(has_permission(&UserRole::Viewer, &Permission::FileRead));
        assert!(!has_permission(&UserRole::Viewer, &Permission::FileWrite));
        assert!(!has_permission(&UserRole::Viewer, &Permission::TerminalExecute));
    }

    #[test]
    fn test_editor_permissions() {
        assert!(has_permission(&UserRole::Editor, &Permission::FileWrite));
        assert!(has_permission(&UserRole::Editor, &Permission::TerminalExecute));
        assert!(!has_permission(&UserRole::Editor, &Permission::CollaboratorInvite));
    }
}
