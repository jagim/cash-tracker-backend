import { createRequest, createResponse } from 'node-mocks-http'
import { AuthController } from '../../../controllers/AuthController'
import User from '../../../models/User'
import { checkPassword, hashPassword } from '../../../utils/auth'
import { generateToken } from '../../../utils/token'
import { AuthEmail } from '../../../emails/AuthEmail'
import { generateJWT } from '../../../utils/jwt'

jest.mock('../../../models/User')
jest.mock('../../../utils/auth')
jest.mock('../../../utils/token')
jest.mock('../../../utils/jwt')

describe('AuthController.createAccount', () => {
    beforeEach(() => {
        jest.resetAllMocks()
    })

    it('should return a 409 status code and an error message if the email is already registered', async () => {
        (User.findOne as jest.Mock).mockResolvedValue(true)
        const req = createRequest({
            method: 'POST',
            url: '/api/auth/create-account',
            body: {
                email: 'test@test.com',
                password: 'testpassword'
            }
        });
        const res = createResponse()
        await AuthController.createAccount(req, res)

        const data = res._getJSONData()
        expect(res.statusCode).toBe(409)
        expect(data).toHaveProperty('error', 'Un usuario con ese email ya esta registrado')
        expect(User.findOne).toHaveBeenCalled()
        expect(User.findOne).toHaveBeenCalledTimes(1)
    })

    it('should register a new user and return a success message', async () => {
        const req = createRequest({
            method: 'POST',
            url: '/api/auth/create-account',
            body: {
                email: 'test@test.com',
                password: 'testpassword',
                name: 'testname'
            }
        });
        const res = createResponse();
        const mockUser = {
            ...req.body,
            save: jest.fn()
        };

        (User.create as jest.Mock).mockResolvedValue(mockUser);
        (hashPassword as jest.Mock).mockResolvedValue('hashedpassword');
        (generateToken as jest.Mock).mockReturnValue('123456');
        jest.spyOn(AuthEmail, 'sendConfirmationEmail').mockImplementation(() => Promise.resolve());
        await AuthController.createAccount(req, res)

        expect(User.create).toHaveBeenCalledWith(req.body)
        expect(User.create).toHaveBeenCalledTimes(1)
        expect(mockUser.save).toHaveBeenCalled()
        expect(mockUser.password).toBe('hashedpassword')
        expect(mockUser.token).toBe('123456')
        expect(AuthEmail.sendConfirmationEmail).toHaveBeenCalledWith({
            email: req.body.email,
            name: req.body.name,
            token: '123456'
        })
        expect(AuthEmail.sendConfirmationEmail).toHaveBeenCalledTimes(1)
        expect(res.statusCode).toBe(201)
    })
})

describe('AuthController.login', () => {
    it('should return 404 if user is not found', async () => {
        const req = createRequest({
            method: 'POST',
            url: '/api/auth/login',
            body: {
                email: 'test@test.com',
                password: 'testpassword'
            }
        });
        const res = createResponse();
        (User.findOne as jest.Mock).mockResolvedValue(null)
        await AuthController.login(req, res)

        const data = res._getJSONData()
        expect(res.statusCode).toBe(404)
        expect(data).toHaveProperty('error', 'Usuario no encontrado')
    })

    it('should return 403 if the account has not been confirmed', async () => {
        const userMock = {
            id: 1,
            email: "test@test.com",
            password: "password",
            confirmed: false
        };

        const req = createRequest({
            method: 'POST',
            url: '/api/auth/login',
            body: {
                email: "test@test.com",
                password: "testpassword"
            }
        })
        const res = createResponse();
        (User.findOne as jest.Mock).mockResolvedValue(userMock);
        await AuthController.login(req, res)

        const data = res._getJSONData()
        expect(res.statusCode).toBe(403)
        expect(data).toEqual({ error: 'La Cuenta no ha sido confirmada' })
    })

    it('should return 401 if the password is incorrect', async () => {
        const userMock = {
            id: 1,
            email: "test@test.com",
            password: "password",
            confirmed: true
        };

        const req = createRequest({
            method: 'POST',
            url: '/api/auth/login',
            body: {
                email: "test@test.com",
                password: "testpassword"
            }
        })
        const res = createResponse();
        (User.findOne as jest.Mock).mockResolvedValue(userMock);
        (checkPassword as jest.Mock).mockResolvedValue(false);
        await AuthController.login(req, res)

        const data = res._getJSONData()
        expect(res.statusCode).toBe(401)
        expect(data).toEqual({ error: 'Password Incorrecto' })
        expect(checkPassword).toHaveBeenCalledWith(req.body.password, userMock.password)
        expect(checkPassword).toHaveBeenCalledTimes(1)
    })

    it('should return a JWT if auth is successfull', async () => {
        const userMock = {
            id: 1,
            email: 'test@test.com',
            password: 'testpassword',
            confirmed: true
        };
        const req = createRequest({
            method: 'POST',
            url: '/api/auth/login',
            body: {
                email: 'test@test.com',
                password: 'testpassword'
            }
        });
        const res = createResponse();
        const fakeJWT = 'fake_jwt';
        (User.findOne as jest.Mock).mockResolvedValue(userMock);
        (checkPassword as jest.Mock).mockResolvedValue(true);
        (generateJWT as jest.Mock).mockReturnValue(fakeJWT);
        await AuthController.login(req, res)

        const data = res._getJSONData()
        expect(res.statusCode).toBe(200)
        expect(data).toEqual(fakeJWT)
        expect(generateJWT).toHaveBeenCalledTimes(1)
        expect(generateJWT).toHaveBeenCalledWith(userMock.id)
    })
})