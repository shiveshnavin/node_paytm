FROM mhart/alpine-node:12

WORKDIR /node-paytm
COPY . .
RUN npm install
CMD ["echo","Starting Migration..."]
CMD ["node", "/node-paytm/example.js"]
 
 