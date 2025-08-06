# Annotate Flow

1. The url will contain a query that mentions the batchID `http://localhost:5173/annotate?batchID=123456`
2. The Firestore Image Metadata will be loaded


## How to load Image and Metadata

**Option 1**

When you first enter the page it will load all the image metadata, it will then reguarly poll the database to verify if your current image is up to date, and if it isn't it will update this

PROS: Fast access to initial image data, loading the first 5 images or something

CONS: if a new image is added to the batch, or some critical information is changed, may cause issues

**Option 2**

Only load 1 image at a time, and when you click to the next image it will then load that one

PROS: less overhead, ensuring that when you view the image it is the most up to date version

CONS: potentially slow as it will need to pull from the database and the bucket individually, and not as a batch



``
