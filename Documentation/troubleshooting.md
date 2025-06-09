

### Cannot run `npm run dev`

1. Ensure you have `node_modules` in the directory, if not try running `npm install`

### Service runs and then instantly closes

This is most likely because you have another service running which is using the same port, make sure the port in the `.env` file is unique
