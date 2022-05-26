const express = require('express')
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tadel.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized Access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('bd-tools').collection('tools');
        const orderCollection = client.db('bd-tools').collection('orders');
        const userCollection = client.db('bd-tools').collection('users');

        // view all tools

        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();

            res.send(tools);
        });

        // view tools by id
        app.get('/purchase/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);

        })


        //store order information

        app.post('/purchasing', async (req, res) => {
            const purchasing = req.body;
            const result = await orderCollection.insertOne(purchasing);
            res.send(result);
        })

        //view orders of an user

        app.get('/myorders', verifyJWT, async (req, res) => {
            const userEmail = req.query.userEmail;

            const query = { clientEmail: userEmail };
            const orders = await orderCollection.find(query).toArray();
            res.send(orders);
        })

        //delete order
        app.delete('/myorder/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        })

        //store user info

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };

            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            const result = await userCollection.updateOne(filter, updateDoc, options)
            res.send({ result, token });
        })


    }
    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello From BD Tools')
})

app.listen(port, () => {
    console.log(` BD Tools app listening on ${port}`)
})