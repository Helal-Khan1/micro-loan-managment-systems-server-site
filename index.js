const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

const cors = require("cors");
require("dotenv").config();
// medilware
app.use(cors());
app.use(express.json());

const admin = require("firebase-admin");

const serviceAccount = require("./microloan-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const varefyFiebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const idToken = authHeader.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);

    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    console.error("Firebase token error:", error.message);
    return res.status(401).send({ message: "Token expired or invalid" });
  }
};

app.get("/", (req, res) => {
  res.send("server is running ");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0pttuht.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();

    const DB = client.db("microLoan");
    const loanCallaction = DB.collection("allLoan");
    const applicationCollcation = DB.collection("loanApplication");
    const userCollection = DB.collection("users");

    // medual ware with database  access

    const varefyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ messaging: "forbident access" });
      }

      next();
    };
    const varefyManager = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);
      if (!user || user.role !== "manager") {
        return res.status(403).send({ messaging: "forbident access" });
      }

      next();
    };

    // user manage related apis

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      console.log(newUser);
      const query = { email: newUser.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.status(200).send({ massage: "User already exists " });
      }
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });
    app.get("/users", async (req, res) => {
      const coursor = userCollection.find();
      const result = await coursor.toArray();
      res.send(result);
    });
    app.get("/users/:email/role", varefyFiebaseToken, async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email };
        const user = await userCollection.findOne(query);

        res.send({ role: user?.role || "borrower" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });
    app.patch("/update_user/:id", varefyFiebaseToken, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          role: req.body.role,
          status: req.body.status,
          whaysuspend: req.body.whaysuspend,
          feedback: req.body.feedback,
        },
      };
      const result = await userCollection.updateOne(query, update);
      res.send(result);
    });

    // loan Application related aips

    app.post("/application", varefyFiebaseToken, async (req, res) => {
      // console.log(req.headers);
      console.log(req.body);
      const newApplication = req.body;
      newApplication.status = "pending";
      newApplication.ApplicationFeeStatus = "unpaid";
      newApplication.FromSubmitDate = new Date();
      const result = await applicationCollcation.insertOne(newApplication);
      res.send(result);
    });
    app.patch("/aplication/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          status: req.body.status,
          approvedDate: new Date(),
        },
      };
      const result = await applicationCollcation.updateOne(query, update);
      res.send(result);
    });
    app.get("/pending_application", async (req, res) => {
      const status = req.query.status; // Pending
      const query = {};

      if (status === status) {
        query.status = status;
      }

      const cursor = applicationCollcation.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/application", async (req, res) => {
      const couursor = applicationCollcation.find();
      const restul = await couursor.toArray();
      res.send(restul);
    });

    // All loan collection and related apis
    app.patch("/updateloan/:id", async (req, res) => {
      const id = req.params.id;
      console.log(req.body);
      const {
        loanImage,
        loanTitle,
        description,
        category,
        interestRate,
        maxLimit,
        emiPlans,
      } = req.body;

      const query = { _id: new ObjectId(id) };
      const loanupdate = {
        $set: {
          loanImage: loanImage,
          loanTitle: loanTitle,
          description: description,
          category: category,
          interestRate: interestRate,
          maxLimit: maxLimit,
          emiPlans: emiPlans,
          isHome: req.body.isHome,
        },
      };
      const result = await loanCallaction.updateOne(query, loanupdate);
      res.send(result);
    });
    app.delete("/delete_loan/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await loanCallaction.deleteOne(query);
      res.send(result);
    });
    app.get("/avilableloan", async (req, res) => {
      const coursor = loanCallaction.find().limit(6);
      const restul = await coursor.toArray();
      res.send(restul);
    });
    app.get("/all_loan", async (req, res) => {
      const seatchText = req.query.search;
      const query = {};
      if (seatchText) {
        // query.category = { $regex: seatchText, $options: "i" };
        query.$or = [
          { category: { $regex: seatchText, $options: "i" } },
          { loanTitle: { $regex: seatchText, $options: "i" } },
        ];
      }
      const coursor = loanCallaction.find(query);
      const result = await coursor.toArray();
      res.send(result);
    });

    app.get("/all_loan/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await loanCallaction.findOne(query);
      res.send(result);
    });

    app.get("/myloan/:email", async (req, res) => {
      const email = req.params.email;

      const query = { UserEmail: email };

      const result = await applicationCollcation.find(query).toArray();
      res.send(result);
    });
    app.post("/microloan", varefyFiebaseToken, async (req, res) => {
      console.log(req.body);
      const newLoan = req.body;
      newLoan.date = new Date();

      const result = await loanCallaction.insertOne(newLoan);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is raning in port ${port}`);
});
