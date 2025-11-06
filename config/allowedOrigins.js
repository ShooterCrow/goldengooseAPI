exports.allowedOrigins = [
    ...(process.env.NODE_ENV !== "production" ? ['http://localhost:5174', 'http://localhost:5173'] : []),
    'https://modloot.xyz/',
    'https://modloot.xyz',
    'https://www.modloot.xyz', 
    'modloot.xyz/',
    'modloot.xyz', 
    "https://www.modloot.xyz",
    "https://goldengoose-git-main-victor-onyekweres-projects.vercel.app"
];
