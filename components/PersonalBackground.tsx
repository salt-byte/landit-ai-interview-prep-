
import React, { useState } from 'react';
import { Upload, FileText, Trash2, Edit2, Check, Sparkles } from 'lucide-react';
import { UploadedFile } from '../types';

const INITIAL_FILES: UploadedFile[] = [
  { id: '1', name: 'Resume_2024_SoftwareEngineer.pdf', type: 'PDF', date: '2024-03-20' },
  { id: '2', name: 'Cloud_Architecture_Project.docx', type: 'DOCX', date: '2024-03-22' },
];

const MOCK_AI_PROFILE = `### Professional Summary
Senior Software Engineer with 6+ years of experience in Full-stack development, specializing in React, Node.js, and Distributed Systems. Proven track record of leading teams to build scalable cloud-native applications.

### Key Skills
- **Frontend:** React, TypeScript, Next.js, Tailwind CSS
- **Backend:** Node.js, Go, PostgreSQL, Redis
- **DevOps:** AWS (EC2, S3, Lambda), Docker, Kubernetes
- **Soft Skills:** Technical Leadership, System Design, Mentorship

### Project Highlights
- **EcoScale Platform:** Scaled user base from 10k to 500k by optimizing database indexing and implementing a robust caching layer.
- **FinTech Dashboard:** Built a real-time data visualization tool used by investment analysts to track $2B in assets.`;

const PersonalBackground: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>(INITIAL_FILES);
  const [aiProfile, setAiProfile] = useState(MOCK_AI_PROFILE);
  const [isEditing, setIsEditing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFile: UploadedFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: e.target.files[0].name,
        type: e.target.files[0].name.split('.').pop()?.toUpperCase() || 'FILE',
        date: new Date().toISOString().split('T')[0],
      };
      setFiles([...files, newFile]);
    }
  };

  const deleteFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Upload Section */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-500" />
            Upload Materials
          </h2>
          <label className="group flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-indigo-400 transition-all">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 mb-2" />
              <p className="text-sm text-slate-600">Click or drag resume/portfolio</p>
            </div>
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>

          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">File List</h3>
            {files.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No files uploaded yet.</p>
            ) : (
              files.map(file => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg group hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">{file.date}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteFile(file.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI Structured Background */}
      <div className="lg:col-span-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2 rounded-lg">
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Structured AI Profile</h2>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isEditing ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isEditing ? (
                <><Check className="w-4 h-4" /> Save Profile</>
              ) : (
                <><Edit2 className="w-4 h-4" /> Edit Profile</>
              )}
            </button>
          </div>

          <div className="prose prose-slate max-w-none">
            {isEditing ? (
              <textarea
                value={aiProfile}
                onChange={(e) => setAiProfile(e.target.value)}
                className="w-full h-[500px] p-4 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm leading-relaxed"
              />
            ) : (
              <div className="whitespace-pre-wrap text-slate-700 leading-relaxed bg-slate-50 p-6 rounded-lg border border-slate-100">
                {aiProfile}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalBackground;
