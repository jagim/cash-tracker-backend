import { Sequelize } from 'sequelize-typescript'
import dontenv from 'dotenv'

dontenv.config()

export const db = new Sequelize(process.env.DATABASE_URL, {
    models: [__dirname + '/../models/**/*'],
    logging: false,
    dialectOptions: {
        ssl: {
            require: false
        }
    }
})