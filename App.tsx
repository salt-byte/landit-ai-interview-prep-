
import React, { useState, useEffect } from 'react';
import { Layout, ArrowLeft, ChevronRight, Home, User, Bell, LogOut } from 'lucide-react';
import Profile from './components/Profile';
import RoleList from './components/RoleList';
import Workspace from './components/Workspace';
import ProfileCard from './components/ProfileCard';
import { TargetRole, AppView, UserProfile } from './types';
import { getProfile, updateProfile } from './api';

const EMPTY_PROFILE: UserProfile = {
  name: '', headline: '', bio: '',
  avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=256&h=256&auto=format&fit=crop',
  targetRoles: '', location: '', educationLevel: '', yearsOfExperience: '',
  education: [], experience: [], projects: [],
  skills: { technical: '', product: '', communication: '' },
  interests: '',
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('DASHBOARD');
  const [selectedRole, setSelectedRole] = useState<TargetRole | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [completionPercentage, setCompletionPercentage] = useState(0);

  useEffect(() => {
    getProfile().then(({ completion_percentage, ...profile }) => {
      setUserProfile(profile as UserProfile);
      setCompletionPercentage(completion_percentage);
    }).catch(() => {});
  }, []);

  const handleSaveProfile = async (updated: UserProfile) => {
    try {
      const { completion_percentage, ...saved } = await updateProfile(updated);
      setUserProfile(saved as UserProfile);
      setCompletionPercentage(completion_percentage);
    } catch (e) {
      console.error('Failed to save profile', e);
    }
  };

  const handleSelectRole = (role: TargetRole) => {
    setSelectedRole(role);
    setView('WORKSPACE');
  };

  const handleBackToDashboard = () => {
    setView('DASHBOARD');
  };

  const handleGoToProfile = () => {
    setView('PROFILE');
  };
  
  const handleGoToWorkspace = () => {
    if (selectedRole) {
      setView('WORKSPACE');
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F9] flex flex-col font-sans text-[#1F1F1F]">
      {/* Global Header (Level 1 Navigation) - Blended Background */}
      <header className="bg-[#F0F4F9] sticky top-0 z-50 h-20 transition-colors duration-200">
        <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center justify-between relative">
          
          {/* Left: Brand */}
          <div className="flex items-center">
            {/* Logo */}
            <div 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={handleBackToDashboard}
            >
              <div className="w-10 h-10 bg-[#1F1F1F] rounded-xl flex items-center justify-center shadow-lg shadow-gray-400/20 group-hover:scale-105 transition-transform">
                <span className="font-bold text-white text-xl font-sans">L</span>
              </div>
              <span className="text-xl font-bold text-[#1F1F1F] tracking-tight">LandIt</span>
            </div>
          </div>

          {/* Center: Global Nav Links - Active State Logic */}
          <nav className="hidden md:flex items-center gap-6 text-sm absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <button 
              onClick={handleGoToWorkspace}
              disabled={!selectedRole}
              className={`transition-colors ${
                view === 'WORKSPACE' 
                  ? 'text-[#1F1F1F] font-bold' 
                  : 'text-[#444746] font-medium hover:text-[#1F1F1F]'
              } ${!selectedRole ? 'opacity-40 cursor-not-allowed hover:text-[#444746]' : ''}`}
            >
              My Role
            </button>
            <span className="text-[#E3E3E3] cursor-default">|</span>
            <button 
              onClick={handleBackToDashboard}
              className={`transition-colors ${
                view === 'DASHBOARD' 
                  ? 'text-[#1F1F1F] font-bold' 
                  : 'text-[#444746] font-medium hover:text-[#1F1F1F]'
              }`}
            >
              Home
            </button>
            <span className="text-[#E3E3E3] cursor-default">|</span>
            <button 
              onClick={handleGoToProfile}
              className={`transition-colors ${
                view === 'PROFILE' 
                  ? 'text-[#1F1F1F] font-bold' 
                  : 'text-[#444746] font-medium hover:text-[#1F1F1F]'
              }`}
            >
              My Profile
            </button>
          </nav>

          {/* Right: User Identity & Actions */}
          <div className="flex items-center gap-4">
             <button className="p-2.5 text-[#444746] hover:bg-white/50 rounded-full transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2.5 right-3 w-2 h-2 bg-[#B3261E] rounded-full border border-[#F0F4F9]"></span>
             </button>

             <div 
                onClick={handleGoToProfile}
                className="flex items-center gap-3 pl-2 cursor-pointer hover:bg-white/50 p-1.5 rounded-full pr-3 transition-colors group"
              >
                 <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm group-hover:border-[#0B57D0] transition-colors relative">
                    <img src={userProfile.avatar} alt="User" className="w-full h-full object-cover" />
                 </div>
                 <div className="hidden sm:block text-left">
                    <p className="text-sm font-bold text-[#1F1F1F]">{userProfile.name}</p>
                 </div>
             </div>
          </div>
        </div>
      </header>

      {/* Primary View Container (Canvas) */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 pb-8">
        {view === 'WORKSPACE' && selectedRole ? (
          <div className="animate-in fade-in duration-300 h-full pt-4">
            <Workspace workspace={selectedRole} />
          </div>
        ) : view === 'PROFILE' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full pt-4">
            <Profile
              profile={userProfile}
              onUpdateProfile={setUserProfile}
              onSaveProfile={handleSaveProfile}
              completionPercentage={completionPercentage}
            />
          </div>
        ) : (
          /* UNIFIED DASHBOARD */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500 pt-8">
            
            {/* Left Column: Roles */}
            <div className="lg:col-span-8 space-y-8">
              <RoleList onSelectRole={handleSelectRole} />
            </div>

            {/* Right Column: Profile Summary */}
            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <ProfileCard 
                profile={userProfile} 
                onEdit={() => setView('PROFILE')} 
                completionPercentage={completionPercentage}
              />
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default App;
