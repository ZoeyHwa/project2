# Uploading Images

## Processing Files and Storing in Blob Storage

Building on [prior explorations with CRUD](https://github.com/ixd-system-design/Managing-Data), this demo adds functionality for photo uploads. Uploaded image files are resized to fit a defined size, and then stored using [Vercel Blob Storage](https://vercel.com/docs/vercel-blob). This results in a URL which we store in MongoDB as an ordinary string. 

## User Interface
The default UI for uploads has been hidden; we use a custom UI inside the input label instead. Drag-and-drop has been implemented, but only where this feature makes sense (A pointer media query prevents it on mobile). 

## Libraries
On the backend, the [BusBoy](https://www.npmjs.com/package/busboy) library handles file uploads efficiently. We also use the [Sharp](https://sharp.pixelplumbing.com/) library to scale images to a predictable and performant size.

## Setup Blob Storage 
Prior to local development, deploy your project to Vercel, and setup Blob storage. When deploying to vercel, add an environment variable `DATABASE_URL` containing your MongoDB connection string. After the first deployment, setup the Blob Storage and redeploy.


# Local Develoment
- Run `npm install` to install express and prisma.
- Add your MongoDB connection string to the `.env` file (see `.env.example` for an example).
- Be sure to include the name of the Database you want to connect to. For example, if your connection string is `mongodb+srv://username:password@cluster.abc.mongodb.net/MyDatabase`, you would change `MyDatabase` to any database name of your choosing.
- If you point to an existing database, you may wish to introspect the schema using the command `npx prisma db pull --force`.
- Alternately, you can start with a blank database, by pointing the connection string to a Database that doesn't exist yet (Mongo creates it automatically as soon as you refer to it).
- Run `npx prisma generate` to create the Prisma Client based on `schema.prisma`.
- Run `npm start` to lauch the app.

## Learning Prompts

- Can you add a connection string to the NodeJS environment (e.g. .env file) for your own MongoDB Atlas Cluster?
- Use MongoDB Compass to verify that your data collection form is working.
- Try out all CRUD operations: Create a new cat, Edit an existing cat by clicking the Edit button, and Delete a cat you no longer need.
- Test the CRUD operations manually via a REST Client / API testing tool. For example try visiting the endpoints defined in `/routes/api.js` using GET, POST, PUT, and DELETE operations from Insomnia.
- Iterate on the prisma schema, form elements, and template, so that data collection and presentation make sense for your own use case.

## Iteration

A typical iteration pattern here would be as follows:

1. create form elements that fit your concept, each with a given `name` (`index.html`)
2. add the new element to the display template (`script.js`) using its proper `name`.
3. add the corresponding `name` to `schema.prisma` with relevant a data type and save
4. re-generate the Prisma Client from the schema using `npx prisma generate`
5. re-start the app using `npm run start`
6. test that all CRUD operations work as expected (Create, Read, Update, Delete)
7. verify that data changes are reflected in MongoDB Compass.
