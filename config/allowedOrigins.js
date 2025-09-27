exports.allowedOrigins = [
    ...(process.env.NODE_ENV !== "production" ? ['http://localhost:5174', 'http://localhost:5173'] : []),
    'https://workearn.online/',
    'https://workearn.online',
    'workearn.online/',
    'workearn.online',
    "https://www.workearn.online",
    "https://goldengoose-kappa.vercel.app"
];
