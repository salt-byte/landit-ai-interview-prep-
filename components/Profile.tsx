import React, { useState } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Edit3,
  Check,
  Plus,
  X,
  Download,
  Link as LinkIcon,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles as SparklesIcon,
  Hash,
  Globe,
  Phone,
  Mail,
  Linkedin,
  User
} from 'lucide-react';
import { UploadedFile, UserProfile } from '../types';
import AddSourceModal from './AddSourceModal';

interface ProfileProps {
  profile: UserProfile;
  onUpdateProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  completionPercentage: number;
}

// --- Initial file list (empty for new users) ---
const INITIAL_FILES: UploadedFile[] = [];

const Profile: React.FC<ProfileProps> = ({ profile: globalProfile, onUpdateProfile, completionPercentage }) => {
  const [files, setFiles] = useState<UploadedFile[]>(INITIAL_FILES);
  const [isEditing, setIsEditing] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // --- Edit State ---
  const [tempProfile, setTempProfile] = useState<UserProfile>(globalProfile);
  const profile = isEditing ? tempProfile : globalProfile;

  // --- Add Source Modal State ---
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);

  // --- Color Logic for Completion ---
  let progressColor = 'bg-[#B3261E]'; // Red
  let progressTextColor = 'text-[#B3261E]';

  if (completionPercentage >= 80) {
    progressColor = 'bg-[#14AE5C]'; // Green
    progressTextColor = 'text-[#14AE5C]';
  } else if (completionPercentage >= 60) {
    progressColor = 'bg-[#FA7B17]'; // Orange
    progressTextColor = 'text-[#FA7B17]';
  }

  // --- Helpers ---
  const isMissing = (val: string | undefined) => !val || val.trim() === '';

  const getFieldStyles = (val: string | undefined) => {
    if (isEditing) {
      return isMissing(val)
        ? "border-red-300 bg-red-50 focus:ring-red-200 placeholder-red-300"
        : "border-[#E3E3E3] focus:ring-[#0B57D0] bg-[#F0F4F9]";
    }
    return "";
  };

  const MissingIndicator = ({ text = "Missing" }: { text?: string }) => (
    <span className="inline-flex items-center gap-1 text-[10px] text-[#B3261E] font-bold uppercase tracking-wider bg-[#FFDAD6] px-2 py-0.5 rounded ml-2">
      {text}
    </span>
  );

  // --- Handlers ---

  const handleAddSource = (newFile: UploadedFile) => {
    setFiles(prev => [newFile, ...prev]);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setShowAddSourceModal(false);
  };

  const handleProfileExtracted = (extracted: Partial<UserProfile>) => {
    const merge = (prev: UserProfile): UserProfile => ({
      ...prev,
      ...(extracted.fullName ? { fullName: extracted.fullName } : {}),
      ...(extracted.targetRole ? { targetRole: extracted.targetRole } : {}),
      ...(extracted.location ? { location: extracted.location } : {}),
      ...(extracted.email ? { email: extracted.email } : {}),
      ...(extracted.phoneNumber ? { phoneNumber: extracted.phoneNumber } : {}),
      ...(extracted.personalWebsite ? { personalWebsite: extracted.personalWebsite } : {}),
      ...(extracted.linkedInProfile ? { linkedInProfile: extracted.linkedInProfile } : {}),
      ...(extracted.employmentType ? { employmentType: extracted.employmentType } : {}),
      ...(extracted.profilePhoto ? { profilePhoto: extracted.profilePhoto } : {}),
      ...(extracted.skills ? { skills: { ...prev.skills, ...extracted.skills } } : {}),
      ...(extracted.education?.length ? { education: extracted.education } : {}),
      ...(extracted.workExperience?.length ? { workExperience: extracted.workExperience } : {}),
      ...(extracted.projects?.length ? { projects: extracted.projects } : {}),
    });
    if (isEditing) {
      setTempProfile(merge);
    } else {
      onUpdateProfile(merge);
    }
  };

  const deleteFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const updateField = (field: keyof UserProfile, value: any) => {
    setTempProfile(prev => ({ ...prev, [field]: value }));
  };

  const updateSkill = (category: keyof UserProfile['skills'], value: string) => {
    setTempProfile(prev => ({ ...prev, skills: { ...prev.skills, [category]: value } }));
  };

  const updateArrayItem = (arrayName: 'education' | 'workExperience' | 'projects', index: number, field: string, value: string) => {
    setTempProfile(prev => {
      const newArray = [...prev[arrayName]] as any[];
      newArray[index] = { ...newArray[index], [field]: value };
      return { ...prev, [arrayName]: newArray };
    });
  };

  const addItem = (arrayName: 'education' | 'workExperience' | 'projects') => {
    const id = Math.random().toString(36).substr(2, 9);
    let newItem;
    if (arrayName === 'education') newItem = { id, institutionName: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', relevantCoursework: '', additionalDetails: '', gpa: '' };
    else if (arrayName === 'workExperience') newItem = { id, companyName: '', jobTitle: '', startDate: '', endDate: '', description: '' };
    else newItem = { id, projectName: '', projectDescription: '', projectLink: '', startDate: '', endDate: '' };

    setTempProfile(prev => ({ ...prev, [arrayName]: [...prev[arrayName], newItem] }));
  };

  const removeItem = (arrayName: 'education' | 'workExperience' | 'projects', index: number) => {
    setTempProfile(prev => {
      const newArray = [...prev[arrayName]];
      newArray.splice(index, 1);
      return { ...prev, [arrayName]: newArray };
    });
  };

  const getFileTypeStyles = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('resume')) return 'bg-amber-50 text-amber-700 border border-amber-100';
    if (t.includes('portfolio')) return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    if (t.includes('work sample')) return 'bg-blue-50 text-blue-700 border border-blue-100';
    if (t.includes('link')) return 'bg-purple-50 text-purple-700 border border-purple-100';
    return 'bg-gray-50 text-gray-600 border border-gray-200';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 relative h-full">

      {/* --- LEFT: Sources Panel --- */}
      <div className="lg:col-span-4 flex flex-col bg-white rounded-[14px] border border-[rgba(0,0,0,0.04)] shadow-[0_6px_18px_rgba(21,28,45,0.06)] p-5 overflow-hidden h-full min-h-[360px]">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">Source Materials</h2>
            <span className="text-xs font-bold text-[#444746] bg-[#F0F4F9] px-2.5 py-1 rounded-full">{files.length}</span>
          </div>

          <div className="mb-6 flex-shrink-0">
            <button
              onClick={() => setShowAddSourceModal(true)}
              className="flex flex-col items-center justify-center w-full p-6 border border-dashed border-[#C4C7C5] rounded-[14px] cursor-pointer hover:bg-[#F0F4F9] hover:border-[#0B57D0] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#0B57D0] p-2 rounded-full text-white shadow-sm group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="block text-sm font-bold text-[#1F1F1F] text-center">Add Source</span>
              </div>
              <span className="text-xs text-[#444746] mt-2 text-center">Upload resumes, portfolios, work samples, notes, or links.</span>
            </button>
            <p className="text-xs text-[#444746] mt-3 text-center px-4 leading-relaxed">
              <span className="font-medium text-[#1F1F1F]">These will be added to your profile and used across your preparation.</span>
            </p>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
             {files.map(file => (
                <div key={file.id} className="flex items-start gap-3 p-3 rounded-xl border border-[#E3E3E3] hover:bg-[#F0F4F9] hover:border-[#C4C7C5] group transition-all bg-white relative">
                  <div className="bg-[#F0F4F9] p-2.5 rounded-lg text-[#0B57D0] mt-0.5">
                    {file.type === 'Link' || file.name.includes('http') ? <LinkIcon className="w-5 h-5"/> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-sm font-semibold text-[#1F1F1F] truncate leading-tight mb-1.5">{file.name}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getFileTypeStyles(file.type)}`}>
                      {file.type}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#F0F4F9] rounded-lg shadow-sm border border-[#E3E3E3]">
                    <button
                      className="p-1.5 hover:bg-[#E3E3E3] rounded-md text-[#444746] transition-colors"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px bg-[#C4C7C5] my-1"></div>
                    <button
                      onClick={() => deleteFile(file.id)}
                      className="p-1.5 hover:bg-[#FFDAD6] hover:text-[#B3261E] rounded-md text-[#444746] transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
      </div>

      {/* --- RIGHT: Career Profile --- */}
      <div className="lg:col-span-8 flex flex-col bg-white rounded-[14px] border border-[rgba(0,0,0,0.04)] shadow-[0_6px_18px_rgba(21,28,45,0.06)] overflow-hidden h-full min-h-[360px]">

          {/* Document Header */}
          <div className="px-8 py-6 border-b border-[#E3E3E3] flex items-center justify-between bg-white flex-shrink-0 min-h-[88px]">
            {isEditing ? (
              <div className="w-full flex justify-end gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="w-32 py-2.5 rounded-full text-sm font-bold bg-[#F0F4F9] text-[#1F1F1F] hover:bg-[#E3E3E3] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onUpdateProfile(tempProfile);
                    setIsEditing(false);
                  }}
                  className="w-32 py-2.5 rounded-full text-sm font-bold bg-[#1F1F1F] text-white hover:bg-[#444746] shadow-md transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-3">
                     <h2 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">Career Profile</h2>
                     <div className="flex items-center gap-2 bg-[#F0F4F9] px-3 py-1 rounded-full">
                       <div className="w-16 h-1.5 bg-[#E3E3E3] rounded-full overflow-hidden">
                         <div className={`h-full ${progressColor}`} style={{width: `${completionPercentage}%`}}></div>
                       </div>
                       <span className={`text-xs font-bold ${progressTextColor}`}>{completionPercentage}% Complete</span>
                     </div>
                  </div>
                  <p className="text-sm text-[#444746] mt-1">The more you add, the better AI can prepare on your behalf.</p>
                </div>
                <button
                  onClick={() => {
                    setTempProfile(globalProfile);
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-[#F0F4F9] text-[#1F1F1F] hover:bg-[#E3E3E3] transition-all"
                >
                  <Edit3 className="w-4 h-4" /> Edit Profile
                </button>
              </>
            )}
          </div>

          {/* Document Content */}
          <div className="px-10 pt-10 pb-10 flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-12">

              {/* 0. Header (Avatar, Name, Target Role) */}
              <section className="text-center">
                 <div className="w-24 h-24 mx-auto rounded-full border-4 border-[#F0F4F9] shadow-sm overflow-hidden mb-4 relative group">
                    {profile.profilePhoto
                      ? <img src={profile.profilePhoto} alt={profile.fullName} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-[#F0F4F9] flex items-center justify-center"><User className="w-10 h-10 text-[#444746]" /></div>
                    }
                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="w-6 h-6 text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const base64 = ev.target?.result as string;
                            onUpdateProfile(prev => ({ ...prev, profilePhoto: base64 }));
                            setTempProfile(prev => ({ ...prev, profilePhoto: base64 }));
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                 </div>

                 {isEditing ? (
                   <div className="space-y-4 max-w-lg mx-auto">
                      <input
                        value={profile.fullName}
                        onChange={e => updateField('fullName', e.target.value)}
                        className={`w-full text-3xl font-bold text-center text-[#1F1F1F] border-b border-dashed outline-none bg-transparent ${getFieldStyles(profile.fullName)}`}
                        placeholder="Full Name (Required)"
                      />
                      <input
                        value={profile.targetRole}
                        onChange={e => updateField('targetRole', e.target.value)}
                        className={`w-full text-lg font-medium text-center text-[#0B57D0] border-b border-dashed outline-none bg-transparent ${getFieldStyles(profile.targetRole)}`}
                        placeholder="Target Role (Required)"
                      />
                      <input
                        value={profile.email || ''}
                        onChange={e => updateField('email', e.target.value)}
                        className={`w-full text-sm text-center text-[#444746] border-b border-dashed outline-none bg-transparent ${getFieldStyles(profile.email)}`}
                        placeholder="Email"
                      />
                      <input
                        value={profile.phoneNumber || ''}
                        onChange={e => updateField('phoneNumber', e.target.value)}
                        className={`w-full text-sm text-center text-[#444746] border-b border-dashed outline-none bg-transparent ${getFieldStyles(profile.phoneNumber)}`}
                        placeholder="Phone Number"
                      />
                      <input
                        value={profile.personalWebsite || ''}
                        onChange={e => updateField('personalWebsite', e.target.value)}
                        className={`w-full text-sm text-center text-[#444746] border-b border-dashed outline-none bg-transparent ${getFieldStyles(profile.personalWebsite)}`}
                        placeholder="Personal Website"
                      />
                      <input
                        value={profile.linkedInProfile || ''}
                        onChange={e => updateField('linkedInProfile', e.target.value)}
                        className={`w-full text-sm text-center text-[#444746] border-b border-dashed outline-none bg-transparent ${getFieldStyles(profile.linkedInProfile)}`}
                        placeholder="LinkedIn Profile URL"
                      />
                      <input
                        value={profile.employmentType || ''}
                        onChange={e => updateField('employmentType', e.target.value)}
                        className={`w-full text-sm text-center text-[#444746] border-b border-dashed outline-none bg-transparent ${getFieldStyles(profile.employmentType)}`}
                        placeholder="Employment Type (e.g. Full-time, Internship)"
                      />
                   </div>
                 ) : (
                   <>
                     <h1 className="text-3xl font-bold text-[#1F1F1F] mb-2">{profile.fullName}</h1>
                     <p className="text-lg font-medium text-[#0B57D0] mb-2">{profile.targetRole}</p>
                     {profile.employmentType && (
                       <p className="text-sm text-[#444746] mb-2">{profile.employmentType}</p>
                     )}
                     <div className="flex items-center justify-center gap-4 flex-wrap mt-2">
                       {profile.email && (
                         <span className="flex items-center gap-1.5 text-sm text-[#444746]">
                           <Mail className="w-3.5 h-3.5 text-[#444746]" /> {profile.email}
                         </span>
                       )}
                       {profile.phoneNumber && (
                         <span className="flex items-center gap-1.5 text-sm text-[#444746]">
                           <Phone className="w-3.5 h-3.5 text-[#444746]" /> {profile.phoneNumber}
                         </span>
                       )}
                       {profile.personalWebsite && (
                         <a href={profile.personalWebsite} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[#0B57D0] hover:underline">
                           <Globe className="w-3.5 h-3.5" /> Website
                         </a>
                       )}
                       {profile.linkedInProfile && (
                         <a href={profile.linkedInProfile} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[#0B57D0] hover:underline">
                           <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                         </a>
                       )}
                     </div>
                   </>
                 )}
              </section>

              {/* 1. Basic Information */}
              <section>
                 <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-6 border-b border-[#F0F4F9] pb-2">Basic Information</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                      <label className="text-xs text-[#444746] font-semibold mb-1 block">Target Role</label>
                      {isEditing ? (
                         <input value={profile.targetRole} onChange={e => updateField('targetRole', e.target.value)} className={`w-full p-2 rounded-lg text-sm text-[#1F1F1F] outline-none border ${getFieldStyles(profile.targetRole)}`} />
                      ) : (
                         <div className="text-sm font-medium text-[#1F1F1F]">
                            {isMissing(profile.targetRole) ? <MissingIndicator /> : profile.targetRole}
                         </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-[#444746] font-semibold mb-1 block">Location</label>
                      {isEditing ? (
                         <input value={profile.location} onChange={e => updateField('location', e.target.value)} className={`w-full p-2 rounded-lg text-sm text-[#1F1F1F] outline-none border ${getFieldStyles(profile.location)}`} />
                      ) : (
                         <div className="text-sm font-medium text-[#1F1F1F] flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#444746]" />
                            {isMissing(profile.location) ? <MissingIndicator /> : profile.location}
                         </div>
                      )}
                    </div>
                 </div>
              </section>

              {/* 2. Education */}
              <section>
                <div className="flex items-center justify-between mb-6 border-b border-[#F0F4F9] pb-3">
                   <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider">Education</h3>
                   {isEditing && <button onClick={() => addItem('education')} className="p-1 hover:bg-[#F0F4F9] rounded-full"><Plus className="w-5 h-5 text-[#0B57D0]" /></button>}
                </div>
                <div className="space-y-8">
                  {profile.education.length === 0 && !isEditing && <p className="text-sm text-[#B3261E] italic bg-[#FFDAD6] inline-block px-3 py-1 rounded">No education details added.</p>}
                  {profile.education.map((edu, index) => (
                    <div key={edu.id} className="relative group">
                      {isEditing && <button onClick={() => removeItem('education', index)} className="absolute -right-6 top-0 text-[#C4C7C5] hover:text-[#B3261E]"><X className="w-4 h-4" /></button>}

                      <div className="flex justify-between items-start mb-1">
                        {isEditing ? (
                           <div className="flex-1 mr-4 space-y-2">
                             <input value={edu.institutionName} onChange={e => updateArrayItem('education', index, 'institutionName', e.target.value)} className={`w-full font-bold text-base border-b border-dashed outline-none bg-transparent ${getFieldStyles(edu.institutionName)}`} placeholder="Institution Name" />
                             <div className="flex gap-2">
                               <input value={edu.degree} onChange={e => updateArrayItem('education', index, 'degree', e.target.value)} className={`w-1/3 text-sm border-b border-dashed outline-none bg-transparent ${getFieldStyles(edu.degree)}`} placeholder="Degree" />
                               <input value={edu.fieldOfStudy} onChange={e => updateArrayItem('education', index, 'fieldOfStudy', e.target.value)} className={`w-2/3 text-sm border-b border-dashed outline-none bg-transparent ${getFieldStyles(edu.fieldOfStudy)}`} placeholder="Field of Study" />
                             </div>
                             <input value={edu.gpa || ''} onChange={e => updateArrayItem('education', index, 'gpa', e.target.value)} className={`w-1/3 text-sm border-b border-dashed outline-none bg-transparent ${getFieldStyles(edu.gpa)}`} placeholder="GPA" />
                           </div>
                        ) : (
                           <div>
                             <h4 className="font-bold text-[#1F1F1F] text-base">{edu.institutionName || '—'}</h4>
                             {(edu.degree || edu.fieldOfStudy) && (
                               <p className="text-sm text-[#1F1F1F]">
                                 {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(' · ')}
                               </p>
                             )}
                             {edu.gpa && (
                               <p className="text-xs text-[#444746]">GPA: {edu.gpa}</p>
                             )}
                           </div>
                        )}

                        {isEditing ? (
                           <div className="flex gap-2">
                             <input value={edu.startDate} onChange={e => updateArrayItem('education', index, 'startDate', e.target.value)} className={`text-sm text-right border-b border-dashed outline-none bg-transparent w-24 ${getFieldStyles(edu.startDate)}`} placeholder="Start Date" />
                             <span className="text-sm text-[#444746]">-</span>
                             <input value={edu.endDate} onChange={e => updateArrayItem('education', index, 'endDate', e.target.value)} className={`text-sm text-right border-b border-dashed outline-none bg-transparent w-24 ${getFieldStyles(edu.endDate)}`} placeholder="End Date" />
                           </div>
                        ) : (
                           <span className="text-sm text-[#444746] font-medium bg-[#F0F4F9] px-2 py-0.5 rounded">{[edu.startDate, edu.endDate].filter(Boolean).join(' - ') || '-'}</span>
                        )}
                      </div>

                      <div className="mt-2 space-y-2">
                         {/* Additional Details */}
                        <div>
                            {isEditing ? (
                                <input value={edu.additionalDetails || ''} onChange={e => updateArrayItem('education', index, 'additionalDetails', e.target.value)} className={`w-full text-xs text-[#444746] border-b border-dashed outline-none bg-transparent ${getFieldStyles(edu.additionalDetails)}`} placeholder="Additional Details (e.g. NLP Research)" />
                            ) : edu.additionalDetails ? (
                                <p className="text-xs text-[#444746]"><span className="font-semibold">Details:</span> {edu.additionalDetails}</p>
                            ) : null}
                        </div>

                        {isEditing ? (
                           <textarea value={edu.relevantCoursework} onChange={e => updateArrayItem('education', index, 'relevantCoursework', e.target.value)} rows={2} className={`w-full text-sm text-[#444746] border-b border-dashed outline-none bg-transparent resize-none ${getFieldStyles(edu.relevantCoursework)}`} placeholder="Relevant Coursework" />
                        ) : edu.relevantCoursework ? (
                           <p className="text-sm text-[#444746] leading-relaxed"><span className="font-semibold text-[#1F1F1F]">Relevant Coursework:</span> {edu.relevantCoursework}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. Work Experience */}
              <section>
                <div className="flex items-center justify-between mb-6 border-b border-[#F0F4F9] pb-3">
                   <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider">Work Experience</h3>
                   {isEditing && <button onClick={() => addItem('workExperience')} className="p-1 hover:bg-[#F0F4F9] rounded-full"><Plus className="w-5 h-5 text-[#0B57D0]" /></button>}
                </div>
                <div className="space-y-10">
                  {profile.workExperience.length === 0 && !isEditing && <p className="text-sm text-[#B3261E] italic bg-[#FFDAD6] inline-block px-3 py-1 rounded">No experience details added.</p>}
                  {profile.workExperience.map((exp, index) => (
                    <div key={exp.id} className="relative group pl-4 border-l-2 border-[#E3E3E3] hover:border-[#0B57D0] transition-colors">
                      {isEditing && <button onClick={() => removeItem('workExperience', index)} className="absolute -right-8 top-0 text-[#C4C7C5] hover:text-[#B3261E]"><X className="w-4 h-4" /></button>}

                      <div className="flex justify-between items-start mb-1">
                        {isEditing ? (
                           <div className="flex-1 space-y-2 mr-4">
                              <input value={exp.companyName} onChange={e => updateArrayItem('workExperience', index, 'companyName', e.target.value)} className={`w-full font-bold text-base border-b border-dashed outline-none bg-transparent ${getFieldStyles(exp.companyName)}`} placeholder="Company Name" />
                              <input value={exp.jobTitle} onChange={e => updateArrayItem('workExperience', index, 'jobTitle', e.target.value)} className={`w-full text-sm font-medium border-b border-dashed outline-none bg-transparent ${getFieldStyles(exp.jobTitle)}`} placeholder="Job Title" />
                           </div>
                        ) : (
                           <div>
                              <h4 className="font-bold text-[#1F1F1F] text-lg">{exp.companyName || '—'}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                {exp.jobTitle && <span className="text-sm font-medium text-[#1F1F1F]">{exp.jobTitle}</span>}
                              </div>
                           </div>
                        )}

                        {isEditing ? (
                           <div className="flex gap-2">
                             <input value={exp.startDate} onChange={e => updateArrayItem('workExperience', index, 'startDate', e.target.value)} className={`text-sm text-right border-b border-dashed outline-none bg-transparent w-24 ${getFieldStyles(exp.startDate)}`} placeholder="Start Date" />
                             <span className="text-sm text-[#444746]">-</span>
                             <input value={exp.endDate} onChange={e => updateArrayItem('workExperience', index, 'endDate', e.target.value)} className={`text-sm text-right border-b border-dashed outline-none bg-transparent w-24 ${getFieldStyles(exp.endDate)}`} placeholder="End Date" />
                           </div>
                        ) : (
                           <span className="text-sm text-[#444746] font-medium whitespace-nowrap">{[exp.startDate, exp.endDate].filter(Boolean).join(' - ') || '-'}</span>
                        )}
                      </div>

                      <div className="mt-3">
                         {isEditing ? (
                            <textarea value={exp.description} onChange={e => updateArrayItem('workExperience', index, 'description', e.target.value)} rows={5} className={`w-full text-sm text-[#444746] border-b border-dashed outline-none bg-transparent resize-none leading-relaxed ${getFieldStyles(exp.description)}`} placeholder="Description (one bullet per line)" />
                         ) : exp.description ? (
                            <ul className="space-y-1 pl-1">
                              {exp.description
                                .split('\n')
                                .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
                                .filter(Boolean)
                                .map((bullet, i) => (
                                  <li key={i} className="flex gap-2 text-sm text-[#444746] leading-relaxed">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#C4C7C5] flex-shrink-0" />
                                    <span>{bullet}</span>
                                  </li>
                                ))}
                            </ul>
                         ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

               {/* 4. Projects */}
              <section>
                 <div className="flex items-center justify-between mb-6 border-b border-[#F0F4F9] pb-3">
                   <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider">Projects</h3>
                   {isEditing && <button onClick={() => addItem('projects')} className="p-1 hover:bg-[#F0F4F9] rounded-full"><Plus className="w-5 h-5 text-[#0B57D0]" /></button>}
                </div>
                <div className="space-y-8">
                  {profile.projects.length === 0 && !isEditing && <p className="text-sm text-[#B3261E] italic bg-[#FFDAD6] inline-block px-3 py-1 rounded">No projects added.</p>}
                  {profile.projects.map((proj, index) => (
                    <div key={proj.id} className="relative group bg-[#FAFAFA] rounded-xl p-5 border border-[#E3E3E3]">
                       {isEditing && <button onClick={() => removeItem('projects', index)} className="absolute right-2 top-2 text-[#C4C7C5] hover:text-[#B3261E]"><X className="w-4 h-4" /></button>}

                       <div className="mb-4">
                         {isEditing ? (
                           <input value={proj.projectName} onChange={e => updateArrayItem('projects', index, 'projectName', e.target.value)} className={`w-full font-bold text-base border-b border-dashed outline-none bg-transparent mb-2 ${getFieldStyles(proj.projectName)}`} placeholder="Project Name" />
                         ) : (
                           <h4 className="font-bold text-[#1F1F1F] text-base">{proj.projectName || 'Untitled Project'} {isMissing(proj.projectName) && <MissingIndicator/>}</h4>
                         )}
                         {isEditing ? (
                            <textarea value={proj.projectDescription} onChange={e => updateArrayItem('projects', index, 'projectDescription', e.target.value)} rows={3} className={`w-full text-sm text-[#444746] border-b border-dashed outline-none bg-transparent resize-none ${getFieldStyles(proj.projectDescription)}`} placeholder="Project Description" />
                         ) : (
                            <p className="text-sm text-[#444746] mt-1">{proj.projectDescription || <MissingIndicator text="Missing Description"/>}</p>
                         )}
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <span className="text-xs font-bold text-[#444746] uppercase block mb-1">Duration</span>
                            {isEditing ? (
                              <div className="flex gap-2">
                                <input value={proj.startDate || ''} onChange={e => updateArrayItem('projects', index, 'startDate', e.target.value)} className={`w-full bg-white border rounded px-2 py-1 outline-none ${getFieldStyles(proj.startDate)}`} placeholder="Start Date" />
                                <input value={proj.endDate || ''} onChange={e => updateArrayItem('projects', index, 'endDate', e.target.value)} className={`w-full bg-white border rounded px-2 py-1 outline-none ${getFieldStyles(proj.endDate)}`} placeholder="End Date" />
                              </div>
                            ) : (
                              <div className="text-[#1F1F1F]">{[proj.startDate, proj.endDate].filter(Boolean).join(' - ') || '-'}</div>
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#444746] uppercase block mb-1">Project Link</span>
                            {isEditing ? (
                              <input value={proj.projectLink || ''} onChange={e => updateArrayItem('projects', index, 'projectLink', e.target.value)} className={`w-full bg-white border rounded px-2 py-1 outline-none ${getFieldStyles(proj.projectLink)}`} placeholder="Project Link URL" />
                            ) : proj.projectLink ? (
                              <a href={proj.projectLink} target="_blank" rel="noopener noreferrer" className="text-[#0B57D0] hover:underline flex items-center gap-1">
                                <LinkIcon className="w-3.5 h-3.5" /> {proj.projectLink}
                              </a>
                            ) : (
                              <div className="text-[#1F1F1F]">-</div>
                            )}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. Skills */}
              <section>
                 <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-6 border-b border-[#F0F4F9] pb-2">Skills</h3>
                 <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-2">
                        <Hash className="w-4 h-4 text-[#0B57D0]" /> Technical & Analytical
                      </h4>
                      {isEditing ? (
                        <textarea value={profile.skills.technicalSkills} onChange={e => updateSkill('technicalSkills', e.target.value)} className={`w-full text-sm p-2 rounded-lg outline-none resize-none border ${getFieldStyles(profile.skills.technicalSkills)}`} placeholder="e.g. SQL, Python..." />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {isMissing(profile.skills.technicalSkills) && <MissingIndicator/>}
                          {profile.skills.technicalSkills.split(',').map((s, i) => s.trim() && <span key={i} className="px-2.5 py-1 bg-[#F0F4F9] text-[#444746] text-sm rounded-lg">{s.trim()}</span>)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-[#0B57D0]" /> Tools & Technologies
                      </h4>
                      {isEditing ? (
                        <textarea value={profile.skills.toolsAndTechnologies} onChange={e => updateSkill('toolsAndTechnologies', e.target.value)} className={`w-full text-sm p-2 rounded-lg outline-none resize-none border ${getFieldStyles(profile.skills.toolsAndTechnologies)}`} placeholder="e.g. Figma, JIRA..." />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                           {isMissing(profile.skills.toolsAndTechnologies) && <MissingIndicator/>}
                           {profile.skills.toolsAndTechnologies.split(',').map((s, i) => s.trim() && <span key={i} className="px-2.5 py-1 bg-[#F0F4F9] text-[#444746] text-sm rounded-lg">{s.trim()}</span>)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 text-[#0B57D0]" /> Soft Skills
                      </h4>
                      {isEditing ? (
                        <textarea value={profile.skills.softSkills} onChange={e => updateSkill('softSkills', e.target.value)} className={`w-full text-sm p-2 rounded-lg outline-none resize-none border ${getFieldStyles(profile.skills.softSkills)}`} placeholder="e.g. Storytelling..." />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                           {isMissing(profile.skills.softSkills) && <MissingIndicator text="Missing Skills"/>}
                           {profile.skills.softSkills.split(',').map((s, i) => s.trim() && <span key={i} className="px-2.5 py-1 bg-[#F0F4F9] text-[#444746] text-sm rounded-lg">{s.trim()}</span>)}
                        </div>
                      )}
                    </div>
                 </div>
              </section>

            </div>
          </div>
      </div>

      {/* --- ADD SOURCE MODAL --- */}
      <AddSourceModal
        isOpen={showAddSourceModal}
        onClose={() => setShowAddSourceModal(false)}
        onAddSource={handleAddSource}
        onProfileExtracted={handleProfileExtracted}
      />

      {/* --- TOAST --- */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-[#1F1F1F] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <Check className="w-4 h-4 text-[#14AE5C]" />
          <span className="text-sm font-medium">Profile updated.</span>
        </div>
      )}

    </div>
  );
};

export default Profile;
