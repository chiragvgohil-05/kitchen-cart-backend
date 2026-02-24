const Joi = require('joi');

const productSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().required(),
    mrp: Joi.number().greater(0).required(),
    sellingPrice: Joi.number().min(0).required(),
    category: Joi.string().required(),
    stock: Joi.number().min(0).required(),
    images: Joi.array().items(Joi.string()),
    keyFeatures: Joi.array().items(Joi.string()),
    technicalSpecs: Joi.object().pattern(Joi.string(), Joi.string())
});

const updateProductSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string(),
    mrp: Joi.number().greater(0),
    sellingPrice: Joi.number().min(0),
    category: Joi.string(),
    stock: Joi.number().min(0),
    images: Joi.array().items(Joi.string()),
    keyFeatures: Joi.array().items(Joi.string()),
    technicalSpecs: Joi.object().pattern(Joi.string(), Joi.string()),
    existingImages: Joi.any() // To handle existing images list from frontend
});

module.exports = {
    productSchema,
    updateProductSchema
};
