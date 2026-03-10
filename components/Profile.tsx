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
  Hash
} from 'lucide-react';
import { UploadedFile, UserProfile } from '../types';
import AddSourceModal from './AddSourceModal';

interface ProfileProps {
  profile: UserProfile;
  onUpdateProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  completionPercentage: number;
}

// --- Mock Data (Files only) ---
const INITIAL_FILES: UploadedFile[] = [
  { id: '1', name: 'Claire_Liu_Resume_USC_PM.pdf', type: 'Resume', date: '2025-01-15' },
  { id: '2', name: 'AI_Product_Case_Study.pdf', type: 'Portfolio', date: '2025-02-10' },
  { id: '3', name: 'Data_Analysis_Sample.sql', type: 'Work Sample', date: '2025-02-12' },
];

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
    // 1. Add File/Link to Source List
    setFiles([newFile, ...files]);

    // 2. Update Profile (Mock Sync Logic)
    const updateLogic = (prev: UserProfile) => {
      const updated = { ...prev };
      // Simulate adding a skill or project based on the new source
      if (newFile.type === 'Resume' || newFile.type === 'Link') {
        updated.skills = {
          ...updated.skills,
          product: updated.skills.product + ", Strategic Planning"
        };
      } else if (newFile.type === 'Portfolio') {
        updated.projects = [
          {
            id: 'new-proj-' + Date.now(),
            name: "New Portfolio Project",
            context: "Extracted from uploaded portfolio",
            role: "Lead Designer",
            tools: "Figma, React",
            outcome: "Launched successfully",
            learnings: "User-centered design is key"
          },
          ...updated.projects
        ];
      }
      return updated;
    };

    if (isEditing) {
      setTempProfile(updateLogic);
    } else {
      onUpdateProfile(updateLogic);
    }

    // 3. Show Toast & Close
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setShowAddSourceModal(false);
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

  const updateArrayItem = (arrayName: 'education' | 'experience' | 'projects', index: number, field: string, value: string) => {
    setTempProfile(prev => {
      const newArray = [...prev[arrayName]] as any[];
      newArray[index] = { ...newArray[index], [field]: value };
      return { ...prev, [arrayName]: newArray };
    });
  };

  const addItem = (arrayName: 'education' | 'experience' | 'projects') => {
    const id = Math.random().toString(36).substr(2, 9);
    let newItem;
    if (arrayName === 'education') newItem = { id, school: '', degree: '', major: '', year: '', keyCoursework: '', academicFocus: '' };
    else if (arrayName === 'experience') newItem = { id, company: '', role: '', type: 'Full-time', duration: '', responsibilities: '' };
    else newItem = { id, name: '', context: '', role: '', tools: '', outcome: '' };

    setTempProfile(prev => ({ ...prev, [arrayName]: [...prev[arrayName], newItem] }));
  };

  const removeItem = (arrayName: 'education' | 'experience' | 'projects', index: number) => {
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
              
              {/* 0. Header (Avatar, Name, Headline, Bio) */}
              <section className="text-center">
                 <div className="w-24 h-24 mx-auto rounded-full border-4 border-[#F0F4F9] shadow-sm overflow-hidden mb-4 relative group">
                    <img 
                      src={profile.avatar} 
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                    {isEditing && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                    )}
                 </div>
                 
                 {isEditing ? (
                   <div className="space-y-4 max-w-lg mx-auto">
                      <input 
                        value={profile.name}
                        onChange={e => updateField('name', e.target.value)}
                        className={`w-full text-3xl font-bold text-center text-[#1F1F1F] border-b border-dashed outline-none bg-transparent ${getFieldStyles(profile.name)}`}
                        placeholder="Full Name (Required)"
                      />
                      <input 
                        value={profile.headline}
                        onChange={e => updateField('headline', e.target.value)}
                        className={`w-full text-lg font-medium text-center text-[#0B57D0] border-b border-dashed outline-none bg-transparent ${getFieldStyles(profile.headline)}`}
                        placeholder="Headline (Required)"
                      />
                      <textarea 
                        value={profile.bio}
                        onChange={e => updateField('bio', e.target.value)}
                        rows={3}
                        className={`w-full text-sm text-[#444746] text-center border-b border-dashed outline-none bg-transparent resize-none leading-relaxed ${getFieldStyles(profile.bio)}`}
                        placeholder="Short Bio / Summary (Required)"
                      />
                   </div>
                 ) : (
                   <>
                     <h1 className="text-3xl font-bold text-[#1F1F1F] mb-2">{profile.name}</h1>
                     <p className="text-lg font-medium text-[#0B57D0] mb-4">{profile.headline}</p>
                     {isMissing(profile.bio) ? (
                        <p className="text-sm text-[#B3261E] italic bg-[#FFDAD6] inline-block px-3 py-1 rounded">Missing Bio</p>
                     ) : (
                        <p className="text-sm text-[#444746] max-w-lg mx-auto leading-relaxed">{profile.bio}</p>
                     )}
                   </>
                 )}
              </section>

              {/* 1. Basic Information */}
              <section>
                 <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-6 border-b border-[#F0F4F9] pb-2">Basic Information</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                      <label className="text-xs text-[#444746] font-semibold mb-1 block">Current Focus / Target Roles</label>
                      {isEditing ? (
                         <input value={profile.targetRoles} onChange={e => updateField('targetRoles', e.target.value)} className={`w-full p-2 rounded-lg text-sm text-[#1F1F1F] outline-none border ${getFieldStyles(profile.targetRoles)}`} />
                      ) : (
                         <div className="text-sm font-medium text-[#1F1F1F]">
                            {isMissing(profile.targetRoles) ? <MissingIndicator /> : profile.targetRoles}
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
                    <div>
                      <label className="text-xs text-[#444746] font-semibold mb-1 block">Education Level</label>
                      {isEditing ? (
                         <input value={profile.educationLevel} onChange={e => updateField('educationLevel', e.target.value)} className={`w-full p-2 rounded-lg text-sm text-[#1F1F1F] outline-none border ${getFieldStyles(profile.educationLevel)}`} />
                      ) : (
                         <div className="text-sm font-medium text-[#1F1F1F] flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-[#444746]" /> 
                            {isMissing(profile.educationLevel) ? <MissingIndicator /> : profile.educationLevel}
                         </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-[#444746] font-semibold mb-1 block">Years of Experience</label>
                      {isEditing ? (
                         <input value={profile.yearsOfExperience} onChange={e => updateField('yearsOfExperience', e.target.value)} className={`w-full p-2 rounded-lg text-sm text-[#1F1F1F] outline-none border ${getFieldStyles(profile.yearsOfExperience)}`} placeholder="e.g. 2 years" />
                      ) : (
                         <div className="text-sm font-medium text-[#1F1F1F] flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-[#444746]" /> 
                            {isMissing(profile.yearsOfExperience) ? <MissingIndicator /> : profile.yearsOfExperience}
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
                             <input value={edu.school} onChange={e => updateArrayItem('education', index, 'school', e.target.value)} className={`w-full font-bold text-base border-b border-dashed outline-none bg-transparent ${getFieldStyles(edu.school)}`} placeholder="School" />
                             <div className="flex gap-2">
                               <input value={edu.degree} onChange={e => updateArrayItem('education', index, 'degree', e.target.value)} className={`w-1/3 text-sm border-b border-dashed outline-none bg-transparent ${getFieldStyles(edu.degree)}`} placeholder="Degree" />
                               <input value={edu.major} onChange={e => updateArrayItem('education', index, 'major', e.target.value)} className={`w-2/3 text-sm border-b border-dashed outline-none bg-transparent ${getFieldStyles(edu.major)}`} placeholder="Major" />
                             </div>
                           </div>
                        ) : (
                           <div>
                             <h4 className="font-bold text-[#1F1F1F] text-base">{edu.school || '—'}</h4>
                             {(edu.degree || edu.major) && (
                               <p className="text-sm text-[#1F1F1F]">
                                 {[edu.degree, edu.major].filter(Boolean).join(' · ')}
                               </p>
                             )}
                           </div>
                        )}
                        
                        {isEditing ? (
                           <input value={edu.year} onChange={e => updateArrayItem('education', index, 'year', e.target.value)} className={`text-sm text-right border-b border-dashed outline-none bg-transparent w-24 ${getFieldStyles(edu.year)}`} placeholder="Year" />
                        ) : (
                           <span className="text-sm text-[#444746] font-medium bg-[#F0F4F9] px-2 py-0.5 rounded">{edu.year || '-'}</span>
                        )}
                      </div>

                      <div className="mt-2 space-y-2">
                         {/* Academic Focus Check */}
                        <div>
                            {isEditing ? (
                                <input value={edu.academicFocus || ''} onChange={e => updateArrayItem('education', index, 'academicFocus', e.target.value)} className={`w-full text-xs text-[#444746] border-b border-dashed outline-none bg-transparent ${getFieldStyles(edu.academicFocus)}`} placeholder="Academic Focus (e.g. NLP Research)" />
                            ) : edu.academicFocus ? (
                                <p className="text-xs text-[#444746]"><span className="font-semibold">Focus:</span> {edu.academicFocus}</p>
                            ) : null}
                        </div>

                        {isEditing ? (
                           <textarea value={edu.keyCoursework} onChange={e => updateArrayItem('education', index, 'keyCoursework', e.target.value)} rows={2} className={`w-full text-sm text-[#444746] border-b border-dashed outline-none bg-transparent resize-none ${getFieldStyles(edu.keyCoursework)}`} placeholder="Key Coursework" />
                        ) : edu.keyCoursework ? (
                           <p className="text-sm text-[#444746] leading-relaxed"><span className="font-semibold text-[#1F1F1F]">Key Coursework:</span> {edu.keyCoursework}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. Experience */}
              <section>
                <div className="flex items-center justify-between mb-6 border-b border-[#F0F4F9] pb-3">
                   <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider">Experience</h3>
                   {isEditing && <button onClick={() => addItem('experience')} className="p-1 hover:bg-[#F0F4F9] rounded-full"><Plus className="w-5 h-5 text-[#0B57D0]" /></button>}
                </div>
                <div className="space-y-10">
                  {profile.experience.length === 0 && !isEditing && <p className="text-sm text-[#B3261E] italic bg-[#FFDAD6] inline-block px-3 py-1 rounded">No experience details added.</p>}
                  {profile.experience.map((exp, index) => (
                    <div key={exp.id} className="relative group pl-4 border-l-2 border-[#E3E3E3] hover:border-[#0B57D0] transition-colors">
                      {isEditing && <button onClick={() => removeItem('experience', index)} className="absolute -right-8 top-0 text-[#C4C7C5] hover:text-[#B3261E]"><X className="w-4 h-4" /></button>}
                      
                      <div className="flex justify-between items-start mb-1">
                        {isEditing ? (
                           <div className="flex-1 space-y-2 mr-4">
                              <input value={exp.company} onChange={e => updateArrayItem('experience', index, 'company', e.target.value)} className={`w-full font-bold text-base border-b border-dashed outline-none bg-transparent ${getFieldStyles(exp.company)}`} placeholder="Company" />
                              <div className="flex gap-2">
                                <input value={exp.role} onChange={e => updateArrayItem('experience', index, 'role', e.target.value)} className={`w-2/3 text-sm font-medium border-b border-dashed outline-none bg-transparent ${getFieldStyles(exp.role)}`} placeholder="Role Title" />
                                <input value={exp.type} onChange={e => updateArrayItem('experience', index, 'type', e.target.value)} className={`w-1/3 text-xs text-[#444746] border-b border-dashed outline-none bg-transparent ${getFieldStyles(exp.type)}`} placeholder="Type (e.g. Internship)" />
                              </div>
                           </div>
                        ) : (
                           <div>
                              <h4 className="font-bold text-[#1F1F1F] text-lg">{exp.company || '—'}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                {exp.role && <span className="text-sm font-medium text-[#1F1F1F]">{exp.role}</span>}
                                {exp.type && <><span className="w-1 h-1 bg-[#C4C7C5] rounded-full"></span><span className="text-xs text-[#444746] bg-[#F0F4F9] px-1.5 py-0.5 rounded">{exp.type}</span></>}
                              </div>
                           </div>
                        )}
                        
                        {isEditing ? (
                           <input value={exp.duration} onChange={e => updateArrayItem('experience', index, 'duration', e.target.value)} className={`text-sm text-right border-b border-dashed outline-none bg-transparent w-24 ${getFieldStyles(exp.duration)}`} placeholder="Duration" />
                        ) : (
                           <span className="text-sm text-[#444746] font-medium whitespace-nowrap">{exp.duration || '-'}</span>
                        )}
                      </div>

                      <div className="mt-3">
                         {isEditing ? (
                            <textarea value={exp.responsibilities} onChange={e => updateArrayItem('experience', index, 'responsibilities', e.target.value)} rows={5} className={`w-full text-sm text-[#444746] border-b border-dashed outline-none bg-transparent resize-none leading-relaxed ${getFieldStyles(exp.responsibilities)}`} placeholder="Responsibilities (one bullet per line)" />
                         ) : exp.responsibilities ? (
                            <ul className="space-y-1 pl-1">
                              {exp.responsibilities
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
                           <input value={proj.name} onChange={e => updateArrayItem('projects', index, 'name', e.target.value)} className={`w-full font-bold text-base border-b border-dashed outline-none bg-transparent mb-2 ${getFieldStyles(proj.name)}`} placeholder="Project Name" />
                         ) : (
                           <h4 className="font-bold text-[#1F1F1F] text-base">{proj.name || 'Untitled Project'} {isMissing(proj.name) && <MissingIndicator/>}</h4>
                         )}
                         {isEditing ? (
                            <input value={proj.context} onChange={e => updateArrayItem('projects', index, 'context', e.target.value)} className={`w-full text-xs text-[#444746] border-b border-dashed outline-none bg-transparent ${getFieldStyles(proj.context)}`} placeholder="Context / Problem" />
                         ) : (
                            <p className="text-xs text-[#444746] italic mt-1">{proj.context || <MissingIndicator text="Missing Context"/>}</p>
                         )}
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <span className="text-xs font-bold text-[#444746] uppercase block mb-1">Role</span>
                            {isEditing ? <input value={proj.role} onChange={e => updateArrayItem('projects', index, 'role', e.target.value)} className={`w-full bg-white border rounded px-2 py-1 outline-none ${getFieldStyles(proj.role)}`} /> : <div className="text-[#1F1F1F]">{proj.role || <MissingIndicator/>}</div>}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#444746] uppercase block mb-1">Tools</span>
                            {isEditing ? <input value={proj.tools} onChange={e => updateArrayItem('projects', index, 'tools', e.target.value)} className={`w-full bg-white border rounded px-2 py-1 outline-none ${getFieldStyles(proj.tools)}`} /> : <div className="text-[#1F1F1F]">{proj.tools || <MissingIndicator/>}</div>}
                          </div>
                       </div>

                       <div>
                          <span className="text-xs font-bold text-[#444746] uppercase block mb-1">Outcome / Impact</span>
                          {isEditing ? (
                            <textarea value={proj.outcome} onChange={e => updateArrayItem('projects', index, 'outcome', e.target.value)} rows={2} className={`w-full text-sm bg-white border rounded px-2 py-1 outline-none resize-none ${getFieldStyles(proj.outcome)}`} />
                          ) : (
                            <p className="text-sm text-[#1F1F1F]">{proj.outcome || <MissingIndicator/>}</p>
                          )}
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
                        <textarea value={profile.skills.technical} onChange={e => updateSkill('technical', e.target.value)} className={`w-full text-sm p-2 rounded-lg outline-none resize-none border ${getFieldStyles(profile.skills.technical)}`} placeholder="e.g. SQL, Python..." />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {isMissing(profile.skills.technical) && <MissingIndicator/>}
                          {profile.skills.technical.split(',').map((s, i) => s.trim() && <span key={i} className="px-2.5 py-1 bg-[#F0F4F9] text-[#444746] text-sm rounded-lg">{s.trim()}</span>)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-[#0B57D0]" /> Product & Strategy
                      </h4>
                      {isEditing ? (
                        <textarea value={profile.skills.product} onChange={e => updateSkill('product', e.target.value)} className={`w-full text-sm p-2 rounded-lg outline-none resize-none border ${getFieldStyles(profile.skills.product)}`} placeholder="e.g. PRD Writing..." />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                           {isMissing(profile.skills.product) && <MissingIndicator/>}
                           {profile.skills.product.split(',').map((s, i) => s.trim() && <span key={i} className="px-2.5 py-1 bg-[#F0F4F9] text-[#444746] text-sm rounded-lg">{s.trim()}</span>)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 text-[#0B57D0]" /> Communication
                      </h4>
                      {isEditing ? (
                        <textarea value={profile.skills.communication} onChange={e => updateSkill('communication', e.target.value)} className={`w-full text-sm p-2 rounded-lg outline-none resize-none border ${getFieldStyles(profile.skills.communication)}`} placeholder="e.g. Storytelling..." />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                           {isMissing(profile.skills.communication) && <MissingIndicator text="Missing Skills"/>}
                           {profile.skills.communication.split(',').map((s, i) => s.trim() && <span key={i} className="px-2.5 py-1 bg-[#F0F4F9] text-[#444746] text-sm rounded-lg">{s.trim()}</span>)}
                        </div>
                      )}
                    </div>
                 </div>
              </section>
              
              {/* 6. Interests */}
              <section>
                 <h3 className="text-xs font-bold text-[#444746] uppercase tracking-wider mb-4 border-b border-[#F0F4F9] pb-2">Interests & Focus Areas</h3>
                 {isEditing ? (
                   <textarea value={profile.interests} onChange={e => updateField('interests', e.target.value)} className={`w-full text-sm p-3 rounded-lg outline-none resize-none border ${getFieldStyles(profile.interests)}`} rows={3} placeholder="What are you passionate about?" />
                 ) : (
                   <p className="text-sm text-[#444746] leading-relaxed italic">
                     {isMissing(profile.interests) ? <MissingIndicator/> : profile.interests}
                   </p>
                 )}
              </section>

            </div>
          </div>
      </div>

      {/* --- ADD SOURCE MODAL --- */}
      <AddSourceModal 
        isOpen={showAddSourceModal} 
        onClose={() => setShowAddSourceModal(false)} 
        onAddSource={handleAddSource} 
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
