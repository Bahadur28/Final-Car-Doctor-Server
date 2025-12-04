const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
  // 'http://localhost:5173',
  'https://cars-doctor-1f496.web.app',
  'https://cars-doctor-1f496.firebaseapp.com'

  ],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

console.log(process.env.DB_USER);
console.log(process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.72xf9sf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middleWare
const logger = async (req, res, next) => {
  console.log('called:', req.host, req.originalUrl)
  next();
}

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log('Value of Token in Middleware', token)
  if (!token) {
    return res.status(401).send({ message: 'Not Authorized' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if (err) {
      console.log(err);
      return res.status(401).send({ message: 'unauthorized' })
    }
    // If token is valid then it would be decoded
    console.log('Value in the token', decoded)
    req.user = decoded;
    next()
  })

}

async function run() {
  try {
    await client.connect();

    const serviceCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('bookings');

    //Auth related Api
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    })

    // Get all services
    app.get('/services', logger, async (req, res) => {
      try {
        const services = await serviceCollection.find().toArray();
        res.send(services); 
      } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Get single service by service_id (string) → no ObjectId
    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      try {
        const query = { service_id: id };
        const options = {
          projection: { title: 1, price: 1, service_id: 1, img: 1, description: 1, facility: 1 }
        };
        const result = await serviceCollection.findOne(query, options);
        if (!result) {
          return res.status(404).send({ message: "Service not found" });
        }
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // bookings
    app.get('/bookings', logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log('Tok Tok Token', req.cookies.token)
      console.log('user in the valid token', req.user)
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: 'Forbidden Access' })
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })


    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBooking = req.body;
      console.log(updatedBooking);
      const updateDoc = {
        $set: {
          status: updatedBooking.status
        },
      };

      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })

    // Ping to confirm successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Successfully connected to MongoDB!");
  } finally {
    // client.close();  // keep connection open for server runtime
  }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => {
  res.send('Doctor Is Running Very Soon');
});

app.listen(port, () => {
  console.log(`Car Doctor Server Is Running On Port ${port}`);
});
