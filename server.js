const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');
const connectDB = require('./config/db');

//Load env vars
dotenv.config({path:'./config/config.env'});

//Connect to database
connectDB();

//Route files
const coworkingSpaces = require('./routes/coworkingSpaces');
const auth = require('./routes/auth');
const reservations = require('./routes/reservations');

const app = express();

//Query parser (so ?province[gt]=x is parsed into nested objects)
app.set('query parser', 'extended');

//Body parser
app.use(express.json());

//Cookie parser
app.use(cookieParser());

//Sanitize data (prevent NoSQL injection)
app.use(mongoSanitize());

//Set security headers
app.use(helmet());

//Prevent XSS attacks
app.use(xss());

//Rate Limiting
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, //10 mins
    max: 100
});
app.use(limiter);

//Prevent http param pollutions
app.use(hpp());

//Enable CORS
app.use(cors());

//Swagger (OpenAPI document)
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Co-working Space Reservation API',
            version: '1.0.0',
            description: 'REST API for reserving rooms at co-working spaces'
        },
        servers: [
            {
                url: 'http://localhost:5000/api/v1'
            }
        ],
    },
    apis: ['./routes/*.js'],
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

//Mount routers
app.use('/api/v1/coworkingspaces', coworkingSpaces);
app.use('/api/v1/auth', auth);
app.use('/api/v1/reservations', reservations);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, console.log('Server running in ', process.env.NODE_ENV, ' mode on port ', PORT));

//Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  //Close server & exit process
  server.close(() => process.exit(1));
});
