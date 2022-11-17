const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { query } = require('express');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8qoxdwe.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req,res,next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send('unauthorized access');
    }

    const token= authHeader.split(' ')[1];
    

    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
            return res.status(403).send({message:'forbidden access'})
        }

        req.decoded = decoded;
        next();
    })
}


async function run(){
    try{

        const appointmentOptionCollection =client.db('doctorsPortal').collection('appoientOptions');
        const bookingsCollection = client.db('doctorsPortal').collection('bookings');
        const usersCollection = client.db('doctorsPortal').collection('users');


        //use Aggregate to query multiple collection and then merge data
        app.get('/appointmentOptions', async(req,res)=>{
            const date = req.query.date;
            console.log(date);
            const query ={};
            const options= await appointmentOptionCollection.find(query).toArray();
            
            const bookingQuery = {appointmentDate: date}
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()
           
            //code carefully
            options.forEach(option=>{
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
                const bookedSlots = optionBooked.map(book => book.slot);
                const remainingSlots= option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
            })
            res.send(options)
        });

        app.get('/bookings',verifyJWT, async(req,res)=>{
            const email = req.query.email;
            // console.log(req.headers.authorization);
            const decodedEmail = req.decoded.email;
            if(email !== decodedEmail){
                return res.status(403).send({message:'forbidden access'})
            }

            const query = {email:email};
            const bookings= await bookingsCollection.find(query).toArray()
            res.send(bookings)
        });

        app.post('/bookings', async(req,res)=>{
            const booking = req.body;
            console.log(booking);
            const query = {
                appointmentDate : booking.appointmentDate,
                treatment : booking.treatment
            }

            const count = await bookingsCollection.find(query).toArray();

            if(count.length){
                const message= `you already booked on ${booking.appointmentDate}`;
                return res.send({acknowledged:false, message})
            }

            const result = await bookingsCollection.insertOne(booking)
            res.send(result);
        });

        app.get('/jwt', async(req,res)=>{
            const email = req.query.email;
            const query = {email: email};
            const user = await usersCollection.findOne(query);
            if(user){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN,{expiresIn:'2d'})
                return res.send({accessToken:token});
            }
            res.status(403).send({accessToken:''})
            console.log(user);
            res.send({accessToken:'token'})
        })

        app.post('/users', async(req,res)=>{
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        });
        
        app.get('/users/admin/:id', async(req,res)=>{
            const id = req.params.id;
            const query ={ _id: ObjectId(id)}
            const user = await usersCollection.findOne(query);
            res.send({isAdmin: user?.role === 'admin'})

        })

        app.put('/users/admin/:id', verifyJWT, async(req,res)=>{
           
            const decodedEmail = req.decoded.email;
            const query = {email:decodedEmail};
            const user = await usersCollection.findOne(query)
            if(user?.role !=='admin'){
                return res.status(403).send({message:'forbidden access'})
            }

            const id = req.params.id;
            const filter = { _id:ObjectId(id)}
            const options = {upsert:true};
            const updateDoc = {
                $set:{
                    role:'admin'
                }
            }
            const result = await usersCollection.updateOne(filter,updateDoc,options);
            res.send(result);

        })

        app.get('/users', async(req,res)=>{
            const query = {};
            const result = await usersCollection.find(query).toArray()
            res.send(result);
        });

      

    }
    finally{

    }
}
run().catch(error=>console.log(error))


app.get('/', async(req,res)=>{
    res.send('doctor portal server running');
})

app.listen(port,()=>{
    console.log(`doctor portal running ${port}`);
})