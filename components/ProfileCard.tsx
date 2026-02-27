
import React from 'react';
import { MapPin, Briefcase, GraduationCap } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileCardProps {
  profile: UserProfile;
  onEdit: () => void;
  completionPercentage: number;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onEdit, completionPercentage }) => {
  // Determine color based on completion percentage
  let progressColor = 'bg-red-500';
  let percentageTextColor = 'text-red-600';

  if (completionPercentage >= 80) {
    progressColor = 'bg-emerald-500';
    percentageTextColor = 'text-emerald-600';
  } else if (completionPercentage >= 60) {
    progressColor = 'bg-orange-500';
    percentageTextColor = 'text-orange-600';
  }

  return (
    <div className="bg-white rounded-[24px] border border-[#E3E3E3] p-8 flex flex-col h-full">
      
      <div className="flex flex-col items-center text-center flex-1">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full border-4 border-[#F0F4F9] shadow-sm mb-4 overflow-hidden">
          <img 
            src={profile.avatar} 
            alt={profile.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Name & Title */}
        <h2 className="text-xl font-medium text-[#1F1F1F]">{profile.name}</h2>
        <p className="text-sm font-medium text-[#444746] mt-1">{profile.headline || 'No Headline'}</p>
        
        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-2 mt-4 mb-6">
           <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F0F4F9] rounded-full text-xs font-medium text-[#444746]">
             <GraduationCap className="w-3.5 h-3.5" /> {profile.educationLevel || 'Education'}
           </div>
           <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F0F4F9] rounded-full text-xs font-medium text-[#444746]">
             <MapPin className="w-3.5 h-3.5" /> {profile.location || 'Location'}
           </div>
           <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F0F4F9] rounded-full text-xs font-medium text-[#444746]">
             <Briefcase className="w-3.5 h-3.5" /> {profile.experience.length} Exp
           </div>
        </div>

        <p className="text-sm text-[#444746] leading-relaxed mb-8 line-clamp-3">
           {profile.bio || "Add a bio to tell AI about your background."}
        </p>
      </div>

      {/* Bottom Actions Section */}
      <div className="w-full mt-auto">
        {/* 1. Main Action Button */}
        <button 
          onClick={onEdit}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#1F1F1F] text-white hover:bg-[#444746] font-medium text-sm transition-all mb-6"
        >
          Manage Profiles
        </button>

        {/* 2. Profile Completion Progress */}
        <div className="mb-3">
           <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#444746] uppercase tracking-wider">Profile Completion</span>
              <span className={`text-xs font-bold ${percentageTextColor}`}>
                 {completionPercentage}%
              </span>
           </div>
           <div className="w-full h-2 bg-[#F0F4F9] rounded-full overflow-hidden">
             <div 
               className={`h-full rounded-full transition-all duration-1000 ease-out ${progressColor}`} 
               style={{ width: `${completionPercentage}%` }}
             ></div>
           </div>
        </div>

        {/* 3. Helper Text */}
        <p className="text-xs text-[#444746] text-center">
           The more you add, the better AI can prepare on your behalf.
        </p>
      </div>
    </div>
  );
};

export default ProfileCard;
