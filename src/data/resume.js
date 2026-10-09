// Single source of truth for all portfolio content. Everything here comes from Akil's resume.
export const profile = {
  name: 'Akil Prabhu A',
  firstName: 'Akil',
  lastName: 'Prabhu',
  title: 'Software Engineer',
  tagline: 'ASP.NET Core · C# · SQL Server · REST APIs · AI-assisted development',
  location: 'Coimbatore, India',
  email: 'akilprabhu2004@gmail.com',
  phone: '+91 88708 56165',
  linkedin: 'https://linkedin.com/in/akil-prabhu',
  github: 'https://github.com/Akil1502',
  summary:
    'Software Engineer with 2 years of experience building and maintaining enterprise web applications using ASP.NET Core, ASP.NET MVC, C#, and SQL Server. Proven in delivering production-grade REST APIs, business logic, and database-driven modules across 5 live enterprise portals. Skilled in applying AI tools, including prompt engineering with Claude and Windsurf IDE, to accelerate code review, feature delivery, and day-to-day engineering workflows.',
  yearsExperience: 2,
  livePortals: 5,
  employeesServed: 1000,
  entities: 3,
}

export const skills = {
  core: [
    { name: 'C# / .NET Core', level: 0.92 },
    { name: 'ASP.NET Core', level: 0.9 },
    { name: 'ASP.NET MVC', level: 0.9 },
    { name: 'Web API', level: 0.88 },
    { name: 'Entity Framework', level: 0.8 },
    { name: 'SQL Server', level: 0.9 },
    { name: 'JavaScript', level: 0.75 },
    { name: 'HTML5 / CSS3 / Bootstrap', level: 0.8 },
    { name: 'Razor Views', level: 0.85 },
    { name: 'Git / Visual Studio', level: 0.85 },
  ],
  ai: [
    { name: 'Claude (Anthropic)', level: 0.9 },
    { name: 'Windsurf IDE', level: 0.85 },
    { name: 'Prompt Engineering', level: 0.88 },
  ],
  concepts: [
    'OOP Principles',
    'REST API Design',
    'Service Architecture',
    'SQL Optimisation',
    'Background SQL Jobs',
  ],
}

export const experience = [
  {
    id: 'bannari',
    role: 'Software Engineer',
    company: 'Bannari Amman Spinning Mills Ltd',
    location: 'Coimbatore, India',
    start: 'Dec 2025',
    end: 'Present',
    current: true,
    bullets: [
      'Develop and maintain 5 enterprise portals: Agent CRM, ESS Portal, MIS Reports, Hangfire Notification System and Knitting Invoice System, using ASP.NET MVC, .NET Core and C#.',
      'Implement REST APIs, backend business logic and SQL Server stored procedures supporting attendance, payroll and invoicing workflows for 1,000+ employees across 3 entities.',
      'Build UI components with HTML, CSS, Bootstrap and Razor following team coding standards; leverage Claude AI and Windsurf IDE to improve code quality.',
      'Optimise SQL queries and resolve production bugs, improving stability across multiple live portals.',
      'Collaborate with senior engineers in sprint planning, code reviews and delivery cycles.',
    ],
    stack: ['ASP.NET MVC', '.NET Core', 'C#', 'SQL Server', 'Hangfire', 'Razor', 'Bootstrap'],
  },
  {
    id: 'creative-ideas',
    role: 'Software Developer',
    company: 'Creative Ideas IT Solutions',
    location: 'Coimbatore, India',
    start: 'Oct 2024',
    end: 'Nov 2025',
    current: false,
    bullets: [
      'Built and maintained client web applications using ASP.NET Core and ASP.NET MVC within an agile team.',
      'Implemented CRUD operations, service-based architecture and third-party API integrations across multiple projects.',
      'Wrote and optimised SQL queries; identified and resolved defects through unit and integration testing cycles.',
      'Developed responsive UI components with JavaScript, HTML and CSS to client specifications.',
    ],
    stack: ['ASP.NET Core', 'ASP.NET MVC', 'C#', 'SQL Server', 'JavaScript', 'REST APIs'],
  },
]

export const projects = [
  {
    id: 'hangfire',
    name: 'Hangfire Notification System',
    stack: ['.NET Core', 'Hangfire', 'SQL Server'],
    description:
      'Designed an automated background job scheduler for employee attendance notifications covering leave and permission tracking organisation-wide.',
    metric: { value: 'Org-wide', label: 'automated notifications' },
    kind: 'scheduler',
  },
  {
    id: 'agent-crm',
    name: 'Agent CRM',
    stack: ['.NET MVC', 'SQL Server', 'AI Tools'],
    description:
      'Developed and maintained 4 to 6 modules in a live enterprise CRM used by ~450 agents daily; built backend services and optimised SQL queries improving module reliability.',
    metric: { value: '450+', label: 'daily agents' },
    kind: 'crm',
  },
  {
    id: 'ess',
    name: 'ESS Attendance Portal',
    stack: ['.NET MVC', 'SQL Server'],
    description:
      'Maintained attendance and payroll portals for 3 company entities (Bannari Mills, Shiva Mills and Automobiles) serving 1,000+ employees; handled backend data processing and resolved critical production issues.',
    metric: { value: '1,000+', label: 'employees served' },
    kind: 'portal',
  },
  {
    id: 'knitting',
    name: 'Knitting Invoice System',
    stack: ['ASP.NET Core', 'SQL Server', 'Crystal Reports'],
    description:
      'Contributed to 4 modules in an enterprise document management application used daily by senior employees; handles end-to-end generation and download of reports, invoices and documents as Crystal Reports, PDF and Excel.',
    metric: { value: '4', label: 'modules shipped' },
    kind: 'documents',
  },
  {
    id: 'prime-delay',
    name: 'Prime Delay Order',
    stack: ['ASP.NET Core', 'SQL Server'],
    description:
      'Developed and maintain 3 modules in an automated daily mail dispatch system that sends current-day production and sales reports to 150 to 200 senior employees; the scheduler runs every day with no manual intervention.',
    metric: { value: '200', label: 'daily recipients' },
    kind: 'mail',
  },
]

export const education = {
  degree: 'B.Com. Digital Marketing & Data Mining',
  school: 'Dr. SNS Rajalakshmi College of Arts & Science',
  location: 'Coimbatore',
  start: '2021',
  end: '2024',
  score: '80%',
}

export const certifications = [
  { name: 'Claude 101', issuer: 'Anthropic', detail: 'Foundations of using Claude effectively' },
  { name: 'Claude Code 101', issuer: 'Anthropic', detail: 'AI-assisted software development with Claude Code' },
  { name: 'Prompt Engineering with Claude', issuer: 'Anthropic Academy', detail: 'Designing effective prompts for reliable AI output' },
  { name: 'Web API Development', issuer: 'GUVI', detail: 'REST · HTTP · JSON · .NET' },
  { name: 'C# with Windows Forms', issuer: 'GUVI', detail: 'C# · OOP · WinForms · .NET' },
]

export const languages = [
  { name: 'English', level: 'Fluent' },
  { name: 'Tamil', level: 'Native' },
]
