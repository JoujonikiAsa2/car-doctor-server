const express = require("express")
const cors = require("cors")
const jwt = require('jsonwebtoken')  //require jwt after install jwt
const cookieParser = require('cookie-parser')
require("dotenv").config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { decode } = require("punycode")

const app = express()
const port = process.env.PORT || 5000

// middleware

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}))

app.use(express.json())
app.use(cookieParser())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ghkhwep.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Middlewares

const logger =  async(req,res,next)=>{
    console.log("Log info :", req.method, req.host,req.url, req.originalUrl)
    next()
}

const verifyToken = async(req, res, next)=>{
    const token = req.cookies?.token;
    console.log('valueof tocken in middlewares', token)
    if(!token){
        return res.status(401).send({message: 'unauthorized'})
    }
    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err, decoded)=>{
        if(err){
            return res.status(401).send({message: 'unauthorized'})
        }
        console.log('value in the token', decoded)
        req.user= decoded
    })
    next()
}

async function run() {
    try {

        // await client.connect();

        const servicesCollection = client.db("carDoctor").collection("services")
        const bookingsCollection = client.db("carDoctor").collection("bookings")

        // Auth related data(Asyncronus)
        // app.post('/jwt',logger, async (req, res) => {
        //     const user = req.body
        //     console.log(user)
        //     const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
        //     console.log(token)
        //     res.send(token)

        // })
        app.post('/jwt',logger, async (req, res) => {
            const user = req.body
            console.log(user)
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            // console.log(token)

            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: false,
                })
                .send({ success: true })

        })

        app.post('/logout', async(req,res)=>{
            const user = req.body;
            console.log("Loggin out user:", user)
            res.clearCookie('token', {maxAge: 0}).send({success: true})
        })

        // Services related data
        app.get("/services",logger, async (req, res) => {
            const cursor = servicesCollection.find()
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get("/bookings", logger, verifyToken, async (req, res) => {
            console.log(req.query)
            // console.log("tok tok",req.cookies.token)
            console.log('user in the valid token', req.user)
            console.log('cookies: ', req.cookies.token)
            let query = {}
            if (req.query.email != req.user.email) {
                return res.status(403).send({message: 'forbidden access'})
            }

            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        })

        app.get("/services/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const options = {
                projection: {
                    title: 1, price: 1, service_id: 1, img: 1
                }
            }
            const result = await servicesCollection.findOne(query, options)
            res.send(result)
        })

        app.post("/bookings", async (req, res) => {
            const bookings = req.body;
            const result = await bookingsCollection.insertOne(bookings)
            res.send(result)
            // console.log(result)
        })

        app.patch("/bookings/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const updatedBooking = req.body
            const updateDoc = {
                $set: {
                    status: updatedBooking.status
                }
            }

            const result = await bookingsCollection.updateOne(query, updateDoc)
            res.send(result)

        })

        app.delete("/bookings/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await bookingsCollection.deleteOne(query)
            res.send(result)
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

        // await client.close();
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Car Doctor Is Running")
})

app.listen(port, () => {
    console.log("Running on port: ", port)
})