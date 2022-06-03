import Joi from 'joi'

export default {
  loginSchema: {
    body: Joi.object({
        email: Joi.string()
        .email({ minDomainSegments: 2, tlds: { allow: ['com', 'net', 'am'] } }),
        password: Joi.string()
        .pattern(new RegExp('^[a-zA-Z0-9]{3,30}$')),
    }),
  },
}