
import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Edit3, 
  Check, 
  Plus, 
  X,
  Download,
  Loader2,
  ChevronDown,
  Link as LinkIcon,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles as SparklesIcon,
  Hash
} from 'lucide-react';
import { UploadedFile, UserProfile } from '../types';
import { getDocuments, uploadAndParseDocument, uploadDocument, deleteDocument } from '../api';

interface ProfileProps {
  profile: UserProfile;
  onUpdateProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onSaveProfile?: (profile: UserProfile) => void | Promise<void>;
  completionPercentage: number;
}

const SOURCE_TAGS = ['Resume', 'Portfolio', 'Work Sample', 'Notes'];

const Profile: React.FC<ProfileProps> = ({ profile, onUpdateProfile, onSaveProfile, completionPercentage }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // --- Upload Workflow State ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: string } | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [suggestedTag, setSuggestedTag] = useState<string>('Notes');
  const [selectedTag, setSelectedTag] = useState<string>('Notes');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDocuments().then(setFiles).catch(() => {});
  }, []);

  // --- Color Logic for Completion ---
  let progressColor = 'bg-red-500';
  if (completionPercentage >= 80) {
    progressColor = 'bg-emerald-500';
  } else if (completionPercentage >= 60) {
    progressColor = 'bg-orange-500';
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

  const guessSourceType = (filename: string) => {
    const name = filename.toLowerCase();
    if (name.includes('resume') || name.includes('cv')) return 'Resume';
    if (name.includes('portfolio') || name.includes('case') || name.includes('project')) return 'Portfolio';
    if (name.includes('sql') || name.includes('code') || name.includes('sample') || name.includes('script') || name.includes('.py') || name.includes('.js')) return 'Work Sample';
    return 'Notes';
  };

  const mergeExtractedProfile = (current: UserProfile, extracted: Partial<UserProfile>): UserProfile => {
    const mergeText = (currentValue: string, nextValue?: string) => nextValue?.trim() ? nextValue : currentValue;

    return {
      ...current,
      name: mergeText(current.name, extracted.name),
      headline: mergeText(current.headline, extracted.headline),
      bio: mergeText(current.bio, extracted.bio),
      avatar: mergeText(current.avatar, extracted.avatar),
      targetRoles: mergeText(current.targetRoles, extracted.targetRoles),
      location: mergeText(current.location, extracted.location),
      educationLevel: mergeText(current.educationLevel, extracted.educationLevel),
      yearsOfExperience: mergeText(current.yearsOfExperience, extracted.yearsOfExperience),
      interests: mergeText(current.interests, extracted.interests),
      skills: {
        technical: mergeText(current.skills.technical, extracted.skills?.technical),
        product: mergeText(current.skills.product, extracted.skills?.product),
        communication: mergeText(current.skills.communication, extracted.skills?.communication),
      },
      education: extracted.education?.length ? extracted.education : current.education,
      experience: extracted.experience?.length ? extracted.experience : current.experience,
      projects: extracted.projects?.length ? extracted.projects : current.projects,
    };
  };

  // --- Handlers ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const inferredTag = guessSourceType(file.name);
    setPendingFile({ name: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB' });
    setPendingUploadFile(file);
    setSuggestedTag(inferredTag);
    setSelectedTag(inferredTag);
    setUploadFeedback(null);
    setShowUploadModal(true);
  };

  const resetUploadState = () => {
    setPendingFile(null);
    setPendingUploadFile(null);
    setSuggestedTag('Notes');
    setSelectedTag('Notes');
    setShowUploadModal(false);
    setIsAnalyzing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmUpload = async () => {
    if (!pendingUploadFile) return;

    setIsAnalyzing(true);
    try {
      if (selectedTag === 'Resume') {
        const result = await uploadAndParseDocument(pendingUploadFile);
        setFiles(prev => [result.document, ...prev]);
        if (Object.keys(result.extracted).length > 0) {
          const mergedProfile = mergeExtractedProfile(profile, result.extracted);
          onUpdateProfile(mergedProfile);
          setIsEditing(true);
          await onSaveProfile?.(mergedProfile);
        }
        if (result.parse_error) {
          setUploadFeedback(`Resume uploaded, but auto-parse failed: ${result.parse_error}`);
        } else {
          setUploadFeedback('Resume uploaded and profile auto-filled. You can still edit the fields on the right.');
        }
      } else {
        const result = await uploadDocument(pendingUploadFile, selectedTag);
        setFiles(prev => [result, ...prev]);
        setUploadFeedback(`${selectedTag} uploaded successfully.`);
      }
      resetUploadState();
    } catch (err) {
      console.error('Upload failed', err);
      setUploadFeedback(err instanceof Error ? err.message : 'Upload failed.');
      setIsAnalyzing(false);
    }
  };

  const cancelUpload = () => {
    resetUploadState();
  };

  const deleteFile = (id: string) => {
    deleteDocument(id).catch(() => {});
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateField = (field: keyof UserProfile, value: any) => {
    onUpdateProfile(prev => ({ ...prev, [field]: value }));
  };
  
  const updateSkill = (category: keyof UserProfile['skills'], value: string) => {
    onUpdateProfile(prev => ({ ...prev, skills: { ...prev.skills, [category]: value } }));
  };

  const updateArrayItem = (arrayName: 'education' | 'experience' | 'projects', index: number, field: string, value: string) => {
    onUpdateProfile(prev => {
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

    onUpdateProfile(prev => ({ ...prev, [arrayName]: [...prev[arrayName], newItem] }));
  };

  const removeItem = (arrayName: 'education' | 'experience' | 'projects', index: number) => {
    onUpdateProfile(prev => {
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
    return 'bg-gray-50 text-gray-600 border border-gray-200';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
      
      {/* --- LEFT: Sources Panel --- */}
      <div className="lg:col-span-4 flex flex-col">
        <div className="bg-white rounded-[24px] border border-[#E3E3E3] p-6 shadow-sm h-[82vh] flex flex-col">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">Source Materials</h2>
            <span className="text-xs font-bold text-[#444746] bg-[#F0F4F9] px-2.5 py-1 rounded-full">{files.length}</span>
          </div>

          <div className="mb-6 flex-shrink-0">
            <label 
              className="flex items-center justify-center w-full p-6 border border-dashed border-[#C4C7C5] rounded-2xl cursor-pointer hover:bg-[#F0F4F9] hover:border-[#0B57D0] transition-all gap-3 group"
            >
              <div className="bg-[#0B57D0] p-2 rounded-full text-white shadow-sm group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-[#1F1F1F] text-center">Add Source</span>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                onChange={handleFileSelect} 
              />
            </label>
            <p className="text-xs text-[#444746] mt-3 text-center px-4 leading-relaxed">
              Upload resumes, portfolios, work samples, notes, or links. <br/>
              <span className="font-medium text-[#1F1F1F]">These will be added to your profile and used across your preparation.</span>
            </p>
            {uploadFeedback && (
              <p className="text-xs mt-3 px-4 leading-relaxed text-left text-[#0B57D0] bg-[#E8F0FE] border border-[#D3E3FD] rounded-xl p-3">
                {uploadFeedback}
              </p>
            )}
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
             {files.map(file => (
                <div key={file.id} className="flex items-start gap-3 p-3 rounded-xl border border-[#E3E3E3] hover:bg-[#F0F4F9] hover:border-[#C4C7C5] group transition-all bg-white relative">
                  <div className="bg-[#F0F4F9] p-2.5 rounded-lg text-[#0B57D0] mt-0.5">
                    {file.name.includes('http') ? <LinkIcon className="w-5 h-5"/> : <FileText className="w-5 h-5" />}
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
      </div>

      {/* --- RIGHT: Career Profile --- */}
      <div className="lg:col-span-8 flex flex-col">
        <div className="bg-white rounded-[24px] border border-[#E3E3E3] shadow-sm overflow-hidden h-[82vh] flex flex-col">
          
          {/* Document Header */}
          <div className="px-8 py-6 border-b border-[#E3E3E3] flex items-center justify-between bg-white flex-shrink-0">
            <div>
              <div className="flex items-center gap-3">
                 <h2 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">Career Profile</h2>
                 <div className="flex items-center gap-2 bg-[#F0F4F9] px-3 py-1 rounded-full">
                   <div className="w-16 h-1.5 bg-[#E3E3E3] rounded-full overflow-hidden">
                     <div className={`h-full ${progressColor}`} style={{width: `${completionPercentage}%`}}></div>
                   </div>
                   <span className="text-xs font-bold text-[#1F1F1F]">{completionPercentage}% Complete</span>
                 </div>
              </div>
              <p className="text-sm text-[#444746] mt-1">The more you add, the better AI can prepare on your behalf.</p>
            </div>
            <button
              onClick={() => {
                if (isEditing) onSaveProfile?.(profile);
                setIsEditing(!isEditing);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                isEditing 
                  ? 'bg-[#1F1F1F] text-white hover:bg-[#444746] shadow-md' 
                  : 'bg-[#F0F4F9] text-[#1F1F1F] hover:bg-[#E3E3E3]'
              }`}
            >
              {isEditing ? <><Check className="w-4 h-4" /> Done Editing</> : <><Edit3 className="w-4 h-4" /> Edit Profile</>}
            </button>
          </div>

          {/* Document Content */}
          <div className="px-10 pt-10 pb-32 flex-1 overflow-y-auto">
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
                             <h4 className="font-bold text-[#1F1F1F] text-base">{edu.school || <MissingIndicator/>}</h4>
                             <p className="text-sm text-[#1F1F1F]">{edu.degree || <MissingIndicator/>} • {edu.major || <MissingIndicator/>}</p>
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
                            ) : (
                                <p className="text-xs text-[#444746]"><span className="font-semibold">Focus:</span> {isMissing(edu.academicFocus) ? <MissingIndicator text="Missing Focus"/> : edu.academicFocus}</p>
                            )}
                        </div>

                        {isEditing ? (
                           <textarea value={edu.keyCoursework} onChange={e => updateArrayItem('education', index, 'keyCoursework', e.target.value)} rows={2} className={`w-full text-sm text-[#444746] border-b border-dashed outline-none bg-transparent resize-none ${getFieldStyles(edu.keyCoursework)}`} placeholder="Key Coursework" />
                        ) : (
                           <p className="text-sm text-[#444746] leading-relaxed"><span className="font-semibold text-[#1F1F1F]">Key Coursework:</span> {isMissing(edu.keyCoursework) ? <MissingIndicator/> : edu.keyCoursework}</p>
                        )}
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
                              <h4 className="font-bold text-[#1F1F1F] text-lg">{exp.company || <MissingIndicator text="Missing Company"/>}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm font-medium text-[#1F1F1F]">{exp.role || <MissingIndicator/>}</span>
                                <span className="w-1 h-1 bg-[#C4C7C5] rounded-full"></span>
                                <span className="text-xs text-[#444746] bg-[#F0F4F9] px-1.5 py-0.5 rounded">{exp.type || '-'}</span>
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
                            <textarea value={exp.responsibilities} onChange={e => updateArrayItem('experience', index, 'responsibilities', e.target.value)} rows={5} className={`w-full text-sm text-[#444746] border-b border-dashed outline-none bg-transparent resize-none leading-relaxed ${getFieldStyles(exp.responsibilities)}`} placeholder="Responsibilities (bullet points)" />
                         ) : (
                            <div className="text-sm text-[#444746] leading-relaxed whitespace-pre-wrap pl-1">
                               {isMissing(exp.responsibilities) ? <MissingIndicator text="Missing Responsibilities"/> : exp.responsibilities}
                            </div>
                         )}
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
      </div>

      {/* --- CONFIRMATION MODAL --- */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-[#1F1F1F]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#E3E3E3]">
              <h3 className="text-lg font-bold text-[#1F1F1F]">Confirm Source Material</h3>
            </div>
            
            <div className="p-8 space-y-6">
              {/* File Info */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#F0F4F9] rounded-xl flex items-center justify-center flex-shrink-0">
                   {isAnalyzing ? (
                     <Loader2 className="w-6 h-6 text-[#0B57D0] animate-spin" />
                   ) : (
                     <FileText className="w-6 h-6 text-[#0B57D0]" />
                   )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#1F1F1F] truncate">{pendingFile?.name}</p>
                  <p className="text-xs text-[#444746]">{pendingFile?.size}</p>
                </div>
              </div>

              {/* Tag Selector */}
              <div>
                <label className="block text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">
                  Content Type
                </label>
                <div className="relative">
                  <select 
                    value={selectedTag} 
                    onChange={(e) => setSelectedTag(e.target.value)}
                    disabled={isAnalyzing}
                    className="w-full p-3 bg-[#F0F4F9] border border-transparent rounded-xl text-[#1F1F1F] font-medium appearance-none outline-none focus:ring-2 focus:ring-[#0B57D0]"
                  >
                    {SOURCE_TAGS.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444746] pointer-events-none" />
                </div>
                {!isAnalyzing && (
                  <p className="text-xs text-[#0B57D0] mt-2 flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3" />
                    AI suggests <b>{suggestedTag}</b>. You can change it before upload.
                  </p>
                )}
                {selectedTag === 'Resume' && (
                  <p className="text-xs text-[#444746] mt-2">
                    Resume uploads will be parsed and auto-fill the profile on the right. You can still edit the fields after.
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 bg-[#FAFAFA] border-t border-[#E3E3E3] flex justify-end gap-3">
              <button 
                onClick={cancelUpload}
                className="px-5 py-2.5 rounded-full font-bold text-sm text-[#444746] hover:bg-[#E3E3E3] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmUpload}
                disabled={isAnalyzing}
                className="px-6 py-2.5 rounded-full bg-[#1F1F1F] text-white font-bold text-sm hover:bg-[#444746] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isAnalyzing ? 'Analyzing...' : 'Confirm & Add'}
                {!isAnalyzing && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
