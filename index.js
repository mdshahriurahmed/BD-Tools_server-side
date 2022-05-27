const express = require('express')
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
        const ratingCollection = client.db('bd-tools').collection('rating');

        // view all tools

        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();

            res.send(tools);
        });

        //find all orders
        app.get('/allorders', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();

            res.send(orders);
        });

        //add new tools
        app.post('/latesttool', async (req, res) => {
            const tool = req.body;
            const result = await toolsCollection.insertOne(tool);
            res.send(result);
        })

        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = ratingCollection.find(query);
            const ratings = await cursor.toArray();

            res.send(ratings);
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
        app.post('/rating', async (req, res) => {
            const rating = req.body;
            const result = await ratingCollection.insertOne(rating);
            res.send(result);
        })

        //view orders of an user

        app.get('/myorders', verifyJWT, async (req, res) => {
            const userEmail = req.query.userEmail;

            const query = { clientEmail: userEmail };
            const orders = await orderCollection.find(query).toArray();
            res.send(orders);
        })


        app.get('/myprofile', verifyJWT, async (req, res) => {
            const userEmail = req.query.userEmail;
            const query = { email: userEmail };
            const profile = await userCollection.findOne(query);
            res.send(profile);
        })

        //delete order
        app.delete('/myorder/:_id', async (req, res) => {
            const _id = req.params._id;
            console.log(_id);
            const filter = { _id: ObjectId(_id) };
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        })

        //delete product
        app.delete('/mytools/:_id', async (req, res) => {
            const _id = req.params._id;
            console.log(_id);
            const filter = { _id: ObjectId(_id) };
            const result = await toolsCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/myorder2/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await orderCollection.findOne(query);
            res.send(tool);

        })

        app.get('/myorders/:id', async (req, res) => {
            const id = req.params.id;

            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.findOne(filter);
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


        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requestAccount = await userCollection.findOne({ email: requester });
            if (requestAccount.role === 'admin') {
                const filter = { email: email };

                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc)
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidded' })
            }

        })

        //update quantity
        app.put('/newtool/:id', async (req, res) => {
            const id = req.params.id;
            const tool = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: tool,
            };

            const result = await toolsCollection.updateOne(filter, updateDoc, options)
            res.send(result);
        })
        app.put('/updatepayment/:id', async (req, res) => {
            const id = req.params.id;
            const tool = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: tool,
            };

            const result = await orderCollection.updateOne(filter, updateDoc, options)
            res.send(result);
        })


        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const tool = req.body;
            const price = tool.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        app.get('/allusers', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
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