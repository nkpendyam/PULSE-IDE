'use client';

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Terminal as TerminalIcon, Plus, Settings, Trash2, Edit, Check,
  ChevronDown, Star, Copy
} from 'lucide-react';
import { TerminalProfile, DEFAULT_PROFILES } from './Terminal';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface TerminalProfileManagerProps {
  profiles?: TerminalProfile[];
  activeProfile?: TerminalProfile;
  onProfileSelect?: (profile: TerminalProfile) => void;
  onProfileCreate?: (profile: Omit<TerminalProfile, 'id' | 'isCustom'>) => void;
  onProfileUpdate?: (profile: TerminalProfile) => void;
  onProfileDelete?: (profileId: string) => void;
  onSetDefault?: (profileId: string) => void;
  className?: string;
  variant?: 'dropdown' | 'panel';
}

interface ProfileFormData {
  name: string;
  shell: string;
  args: string;
  icon: string;
  color: string;
}

// ============================================================================
// COMMON SHELLS
// ============================================================================

const COMMON_SHELLS = [
  { value: '/bin/bash', label: 'Bash', icon: '🐚' },
  { value: '/bin/zsh', label: 'Zsh', icon: '⚡' },
  { value: '/bin/sh', label: 'Sh', icon: '📜' },
  { value: 'pwsh', label: 'PowerShell', icon: '💻' },
  { value: 'powershell', label: 'PowerShell (Windows)', icon: '💻' },
  { value: 'node', label: 'Node.js REPL', icon: '🟢' },
  { value: 'python', label: 'Python', icon: '🐍' },
  { value: 'python3', label: 'Python 3', icon: '🐍' },
  { value: 'fish', label: 'Fish', icon: '🐟' },
  { value: '/usr/local/bin/fish', label: 'Fish (local)', icon: '🐟' },
];

// ============================================================================
// PROFILE ICONS
// ============================================================================

const PROFILE_ICONS = [
  '🐚', '⚡', '💻', '🟢', '🐍', '🐟', '📜', '🔧', '⚙️', '🎯',
  '🚀', '💡', '🔥', '⭐', '🎨', '🎮', '📦', '🏗️', '🌐', '📊',
];

// ============================================================================
// PROFILE COLORS
// ============================================================================

const PROFILE_COLORS = [
  '#4EAA25', // Green (Bash)
  '#F40009', // Red (Zsh)
  '#5391FE', // Blue (PowerShell)
  '#339933', // Node green
  '#3776AB', // Python blue
  '#888888', // Gray
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#45B7D1', // Sky
  '#96CEB4', // Sage
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultProfileId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('kyro-terminal-default-profile') || DEFAULT_PROFILES[0].id;
  }
  return DEFAULT_PROFILES[0].id;
}

function getLastUsedProfile(profiles: TerminalProfile[]): TerminalProfile {
  if (typeof window !== 'undefined') {
    const savedId = localStorage.getItem('kyro-terminal-last-profile');
    if (savedId) {
      const found = profiles.find(p => p.id === savedId);
      if (found) return found;
    }
  }
  return profiles[0];
}

// ============================================================================
// PROFILE EDITOR DIALOG
// ============================================================================

interface ProfileEditorDialogProps {
  profile?: TerminalProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProfileFormData) => void;
  mode: 'create' | 'edit';
}

function ProfileEditorDialog({
  profile,
  isOpen,
  onClose,
  onSave,
  mode,
}: ProfileEditorDialogProps) {
  // Get initial form data from profile
  const getInitialFormData = useCallback((): ProfileFormData => {
    if (profile && mode === 'edit') {
      return {
        name: profile.name,
        shell: profile.shell,
        args: profile.args?.join(' ') || '',
        icon: profile.icon || '🐚',
        color: profile.color || '#4EAA25',
      };
    }
    return {
      name: '',
      shell: '/bin/bash',
      args: '',
      icon: '🐚',
      color: '#4EAA25',
    };
  }, [profile, mode]);

  const [formData, setFormData] = useState<ProfileFormData>(getInitialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFormData, string>>>({});

  // Reset form when dialog opens or profile changes
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose();
    } else {
      // Reset form when opening
      setFormData(getInitialFormData());
      setErrors({});
    }
  }, [onClose, getInitialFormData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProfileFormData, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Profile name is required';
    }
    if (!formData.shell.trim()) {
      newErrors.shell = 'Shell path is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TerminalIcon className="h-5 w-5" />
            {mode === 'create' ? 'Create Terminal Profile' : 'Edit Profile'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new terminal profile with custom settings.'
              : 'Modify the terminal profile settings.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Profile Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              Profile Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Custom Profile"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Shell Selection */}
          <div className="space-y-2">
            <Label htmlFor="shell" className="text-sm">
              Shell
            </Label>
            <div className="flex gap-2">
              <Select
                value={formData.shell}
                onValueChange={(value) => setFormData({ ...formData, shell: value })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select shell" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SHELLS.map((shell) => (
                    <SelectItem key={shell.value} value={shell.value}>
                      <span className="mr-2">{shell.icon}</span>
                      {shell.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={formData.shell}
                onChange={(e) => setFormData({ ...formData, shell: e.target.value })}
                placeholder="Custom path"
                className="w-40"
              />
            </div>
            {errors.shell && (
              <p className="text-xs text-red-500">{errors.shell}</p>
            )}
          </div>

          {/* Arguments */}
          <div className="space-y-2">
            <Label htmlFor="args" className="text-sm">
              Arguments
            </Label>
            <Input
              id="args"
              value={formData.args}
              onChange={(e) => setFormData({ ...formData, args: e.target.value })}
              placeholder="-l, -c, etc."
            />
            <p className="text-xs text-zinc-500">
              Space-separated arguments for the shell
            </p>
          </div>

          {/* Icon Selection */}
          <div className="space-y-2">
            <Label className="text-sm">Icon</Label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-900 rounded-lg">
              {PROFILE_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded text-lg',
                    formData.icon === icon
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-zinc-800 hover:bg-zinc-700'
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label className="text-sm">Color</Label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-900 rounded-lg">
              {PROFILE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={cn(
                    'w-8 h-8 rounded flex items-center justify-center',
                    formData.color === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                      : 'hover:ring-1 hover:ring-white/50'
                  )}
                  style={{ backgroundColor: color }}
                >
                  {formData.color === color && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label htmlFor="customColor" className="text-xs">Custom:</Label>
              <Input
                id="customColor"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-10 h-8 p-1 cursor-pointer"
              />
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#4EAA25"
                className="w-24 h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {mode === 'create' ? 'Create Profile' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// PROFILE CARD COMPONENT
// ============================================================================

interface ProfileCardProps {
  profile: TerminalProfile;
  isActive?: boolean;
  isDefault?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
  onDuplicate?: () => void;
}

function ProfileCard({
  profile,
  isActive,
  isDefault,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  onDuplicate,
}: ProfileCardProps) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all',
        isActive
          ? 'bg-primary/10 border-primary/30'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: profile.color + '20' }}
          >
            {profile.icon || '🐚'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{profile.name}</span>
              {isDefault && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  <Star className="h-2.5 w-2.5 mr-0.5" />
                  Default
                </Badge>
              )}
              {profile.isCustom && (
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  Custom
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{profile.shell}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Settings className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-3 w-3 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-3 w-3 mr-2" />
              Duplicate
            </DropdownMenuItem>
            {!isDefault && (
              <DropdownMenuItem onClick={onSetDefault}>
                <Star className="h-3 w-3 mr-2" />
                Set as Default
              </DropdownMenuItem>
            )}
            {profile.isCustom && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="text-red-400"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {profile.args && profile.args.length > 0 && (
        <div className="mt-2 text-xs text-zinc-500">
          Args: {profile.args.join(' ')}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PROFILE SELECTOR DROPDOWN
// ============================================================================

interface ProfileSelectorDropdownProps {
  profiles: TerminalProfile[];
  activeProfile?: TerminalProfile;
  onProfileSelect: (profile: TerminalProfile) => void;
  onCreateProfile?: () => void;
  defaultProfileId?: string;
}

function ProfileSelectorDropdown({
  profiles,
  activeProfile,
  onProfileSelect,
  onCreateProfile,
  defaultProfileId,
}: ProfileSelectorDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs bg-zinc-900 border-zinc-700"
        >
          {activeProfile && (
            <span style={{ color: activeProfile.color }}>
              {activeProfile.icon}
            </span>
          )}
          <span>{activeProfile?.name || 'Select Profile'}</span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">
          Terminal Profiles
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {profiles.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            onClick={() => onProfileSelect(profile)}
            className="flex items-center gap-2"
          >
            <span style={{ color: profile.color }}>{profile.icon}</span>
            <span className="flex-1">{profile.name}</span>
            {profile.id === defaultProfileId && (
              <Star className="h-3 w-3 text-yellow-500" />
            )}
            {activeProfile?.id === profile.id && (
              <Check className="h-3 w-3 text-green-500" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateProfile}>
          <Plus className="h-3 w-3 mr-2" />
          Create Custom Profile
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// TERMINAL PROFILE MANAGER COMPONENT
// ============================================================================

export default function TerminalProfileManager({
  profiles: externalProfiles,
  activeProfile,
  onProfileSelect,
  onProfileCreate,
  onProfileUpdate,
  onProfileDelete,
  onSetDefault,
  className,
  variant = 'dropdown',
}: TerminalProfileManagerProps) {
  // Internal state for standalone usage
  const [internalProfiles, setInternalProfiles] = useState<TerminalProfile[]>(DEFAULT_PROFILES);
  
  // Use lazy initialization for the active profile based on localStorage
  const [internalActiveProfile, setInternalActiveProfile] = useState<TerminalProfile>(() => {
    return getLastUsedProfile(DEFAULT_PROFILES);
  });
  
  const [defaultProfileId, setDefaultProfileId] = useState<string>(getDefaultProfileId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TerminalProfile | null>(null);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');

  // Use external or internal state
  const profiles = externalProfiles || internalProfiles;
  const currentProfile = activeProfile || internalActiveProfile;

  // Save last used profile to localStorage
  const handleProfileSelect = useCallback((profile: TerminalProfile) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kyro-terminal-last-profile', profile.id);
    }
    if (onProfileSelect) {
      onProfileSelect(profile);
    } else {
      setInternalActiveProfile(profile);
    }
  }, [onProfileSelect]);

  // Handle create profile
  const handleCreateProfile = useCallback((data: ProfileFormData) => {
    const newProfile: TerminalProfile = {
      id: `custom-${Date.now()}`,
      name: data.name,
      shell: data.shell,
      args: data.args.split(' ').filter(Boolean),
      icon: data.icon,
      color: data.color,
      isCustom: true,
    };

    if (onProfileCreate) {
      onProfileCreate({
        name: data.name,
        shell: data.shell,
        args: data.args.split(' ').filter(Boolean),
        icon: data.icon,
        color: data.color,
      });
    } else {
      setInternalProfiles(prev => [...prev, newProfile]);
      setInternalActiveProfile(newProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('kyro-terminal-last-profile', newProfile.id);
      }
    }
  }, [onProfileCreate]);

  // Handle update profile
  const handleUpdateProfile = useCallback((data: ProfileFormData) => {
    if (!editingProfile) return;

    const updatedProfile: TerminalProfile = {
      ...editingProfile,
      name: data.name,
      shell: data.shell,
      args: data.args.split(' ').filter(Boolean),
      icon: data.icon,
      color: data.color,
    };

    if (onProfileUpdate) {
      onProfileUpdate(updatedProfile);
    } else {
      setInternalProfiles(prev =>
        prev.map(p => p.id === updatedProfile.id ? updatedProfile : p)
      );
      if (internalActiveProfile.id === updatedProfile.id) {
        setInternalActiveProfile(updatedProfile);
      }
    }
  }, [editingProfile, onProfileUpdate, internalActiveProfile.id]);

  // Handle delete profile
  const handleDeleteProfile = useCallback((profileId: string) => {
    if (onProfileDelete) {
      onProfileDelete(profileId);
    } else {
      setInternalProfiles(prev => prev.filter(p => p.id !== profileId));
      if (internalActiveProfile.id === profileId) {
        const newActive = internalProfiles.find(p => p.id !== profileId) || DEFAULT_PROFILES[0];
        setInternalActiveProfile(newActive);
      }
    }
  }, [onProfileDelete, internalActiveProfile.id, internalProfiles]);

  // Handle set default
  const handleSetDefault = useCallback((profileId: string) => {
    if (onSetDefault) {
      onSetDefault(profileId);
    } else {
      setDefaultProfileId(profileId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('kyro-terminal-default-profile', profileId);
      }
    }
  }, [onSetDefault]);

  // Handle duplicate profile
  const handleDuplicateProfile = useCallback((profile: TerminalProfile) => {
    const newProfile: TerminalProfile = {
      ...profile,
      id: `custom-${Date.now()}`,
      name: `${profile.name} (Copy)`,
      isCustom: true,
    };

    if (onProfileCreate) {
      onProfileCreate({
        name: newProfile.name,
        shell: newProfile.shell,
        args: newProfile.args,
        icon: newProfile.icon,
        color: newProfile.color,
      });
    } else {
      setInternalProfiles(prev => [...prev, newProfile]);
    }
  }, [onProfileCreate]);

  const openCreateDialog = useCallback(() => {
    setEditingProfile(null);
    setEditorMode('create');
    setEditorOpen(true);
  }, []);

  const openEditDialog = useCallback((profile: TerminalProfile) => {
    setEditingProfile(profile);
    setEditorMode('edit');
    setEditorOpen(true);
  }, []);

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <>
        <ProfileSelectorDropdown
          profiles={profiles}
          activeProfile={currentProfile}
          onProfileSelect={handleProfileSelect}
          onCreateProfile={openCreateDialog}
          defaultProfileId={defaultProfileId}
        />
        <ProfileEditorDialog
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
          onSave={handleCreateProfile}
          mode="create"
        />
      </>
    );
  }

  // Panel variant
  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Terminal Profiles
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={openCreateDialog}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Profile List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Built-in profiles */}
          <div className="text-xs text-zinc-500 px-2 py-1">Built-in</div>
          {profiles.filter(p => !p.isCustom).map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={currentProfile.id === profile.id}
              isDefault={defaultProfileId === profile.id}
              onSelect={() => handleProfileSelect(profile)}
              onEdit={() => openEditDialog(profile)}
              onSetDefault={() => handleSetDefault(profile.id)}
              onDuplicate={() => handleDuplicateProfile(profile)}
            />
          ))}

          {/* Custom profiles */}
          {profiles.some(p => p.isCustom) && (
            <>
              <Separator className="my-3" />
              <div className="text-xs text-zinc-500 px-2 py-1">Custom</div>
              {profiles.filter(p => p.isCustom).map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  isActive={currentProfile.id === profile.id}
                  isDefault={defaultProfileId === profile.id}
                  onSelect={() => handleProfileSelect(profile)}
                  onEdit={() => openEditDialog(profile)}
                  onDelete={() => handleDeleteProfile(profile.id)}
                  onSetDefault={() => handleSetDefault(profile.id)}
                  onDuplicate={() => handleDuplicateProfile(profile)}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t border-zinc-800">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={openCreateDialog}
        >
          <Plus className="h-3 w-3 mr-1" />
          Create Custom Profile
        </Button>
      </div>

      {/* Editor Dialog */}
      <ProfileEditorDialog
        profile={editingProfile || undefined}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={editorMode === 'create' ? handleCreateProfile : handleUpdateProfile}
        mode={editorMode}
      />
    </div>
  );
}

// Export utility components
export { ProfileEditorDialog, ProfileCard, ProfileSelectorDropdown };
export type { ProfileFormData, TerminalProfileManagerProps };
