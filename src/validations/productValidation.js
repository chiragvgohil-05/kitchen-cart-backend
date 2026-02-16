const Joi = require('joi');

const productSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().min(0).required(),
    category: Joi.string().required(),
    stock: Joi.number().min(0).required(),
    imageUrl: Joi.string().uri().required()
});

const updateProductSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string(),
    price: Joi.number().min(0),
    category: Joi.string(),
    stock: Joi.number().min(0),
    imageUrl: Joi.string().uri()
});

module.exports = {
    productSchema,
    updateProductSchema
};
