import * as express from 'express'
import * as cors from 'cors'
import { createConnection } from 'typeorm'
import { Product } from './entity/product'
import * as amqp from 'amqplib/callback_api'
import { channel } from 'diagnostics_channel'

createConnection().then(db =>{

    const productRepository = db.getRepository(Product);

    amqp.connect('amqps://bshhulim:DYXAQIkuFG9jUMcR94QpSZHKlPQgu4Xr@jackal.rmq.cloudamqp.com/bshhulim', (error0,connection) =>{
        if(error0){
            throw error0
        }
        connection.createChannel((error1, channel) =>{
            if(error1){
                throw error1
            }

            // Lists of services

            channel.assertQueue('get_product', {durable:true})
            channel.assertQueue('product_by_id', {durable:true})
            channel.assertQueue('product_created', {durable:true})
            channel.assertQueue('product_updated', {durable:true})
            channel.assertQueue('product_deleted', {durable:true})
            channel.assertQueue('product_like', {durable:true})

            // middlewars

            const app = express()

            app.use(cors({
                origin:['http://localhost:3000','http://localhost:8080','http://localhost:4200']
            }))
        
            app.use(express.json())

            // Get products

            channel.consume('get_product', (msg) =>{
                console.log(msg.content.toString())
            })

            // Create product

            channel.consume('product_created', async (msg) =>{
                const eventProduct: Product = JSON.parse(msg.content.toString())
                const product = await productRepository.create(eventProduct)
                const result = await productRepository.save(product)
                console.log('product created')
            }, {noAck:true})

            // Get product by id

            channel.consume('product_by_id', async (msg) =>{
                const eventProduct: Product = JSON.parse(msg.content.toString())
                console.log('product by id')
            }, {noAck:true})

            // Create product

            channel.consume('product_created', async (msg) =>{
                const eventProduct: Product = JSON.parse(msg.content.toString())
                const product = await productRepository.create(eventProduct)
                const result = await productRepository.save(product)
                console.log('product created')
            }, {noAck:true})

            // Update product

            channel.consume('product_updated', async (msg) =>{
                const eventProduct: Product = JSON.parse(msg.content.toString())
                const product = await productRepository.findOne({where:{id:eventProduct.id}})
                productRepository.merge(product, eventProduct)
                const result = await productRepository.save(product)
                console.log('product updated')
            }, {noAck:true})

            // Delete product

            channel.consume('product_deleted', async (msg) =>{
                const eventProduct: Product = JSON.parse(msg.content.toString())
                const result = await productRepository.delete(eventProduct.id)
                console.log('product deleted')
            })

            // Like product

            channel.consume('product_like', async (msg) =>{
                const eventProduct: Product = JSON.parse(msg.content.toString())
                const product = await productRepository.findOne({where:{id:eventProduct.id}})
                product.likes++
                const result = await productRepository.save(product)
                console.log('like product')
            })

            // Server on port

            app.listen(8001, () =>{
                console.log('Server on port: 8001')
            })

            process.on('beforeExit',() =>{
                console.log('closing')
                connection.close()
            })
        
            // get products
        
            app.get('/api/product', async (req:Request, res:Response) =>{
                const products = await productRepository.find()
                channel.sendToQueue('get_product', Buffer.from(JSON.stringify(products)));
                res.json(products)
            }) 
        
            //create product
        
            app.post('/api/product', async(req:Request,res:Response) =>{
                const product = await productRepository.create(req.body)
                const result = await productRepository.save(req.body)
                channel.sendToQueue('product_created', Buffer.from(JSON.stringify(result)))
                return res.send(result)
            })
        
            // get product by id product
        
            app.get('/api/product/:id', async(req:Request, res:Response) =>{
                const product = await productRepository.findOne({where:{id:req.params.id}})
                channel.sendToQueue('product_by_id', Buffer.from(JSON.stringify(req.params.id)))
                return res.send(product)
            })
        
            // update product
        
            app.put('/api/product/:id',async (req:Request, res:Response) => {
                const product = await productRepository.findOne({where:{id:req.params.id}})
                productRepository.merge(product, req.body)
                const result = await productRepository.save(product)
                channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(result)))
                return res.send(result)
            })
        
            // delete product
        
            app.delete('/api/product/:id',async (req:Request, res:Response) => {
                const result = await productRepository.delete(req.params.id)
                channel.sendToQueue('product_deleted', Buffer.from(req.params.id))
                return res.send(result)
            })
        
            // add likes
        
            app.post('/api/product/:id/like', async (req:Request, res:Response) =>{
                const product = await productRepository.findOne({where:{id:req.params.id}})
                product.likes++
                const result = await productRepository.save(product)
                channel.sendToQueue('product_like', Buffer.from(req.params.id))
                return res.send(result)
            })
        })
    })
})
