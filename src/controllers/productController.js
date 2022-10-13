const ProductModel = require("../models/productModel");
const AWS = require("../utilities/aws");
const { isValidInputBody, isValidInputValue, isValidOnlyCharacters, isValidAddress, isValidEmail, isValidPhone, isValidPassword,
    isValidNumber, isValidPincode, isValidPrice, isValidObjectId, isValidImageType } = require("../utilities/validator");
const getSymbolFromCurrency = require("currency-symbol-map");
const { Convert } = require("easy-currencies");

//********************************REGISTERING NEW PRODUCT****************************************** */

const registerProduct = async function (req, res) {
    try {
        const requestBody = req.body;
        const queryParams = req.query;
        const image = req.files;

        // data not required from query params
        if (isValidInputBody(queryParams)) {
            return res
                .status(404)
                .send({ status: false, message: "Page not found" });
        }
        // request body must not be empty
        if (!isValidInputBody(requestBody)) {
            return res
                .status(400)
                .send({ status: false, message: "Product data is required for registration" });
        }

        let { title, description, price, currencyId, currencyFormat, isFreeShipping, style, availableSizes, installments } = requestBody;

        // validation starts here
        if (!isValidInputValue(title)) {
            return res
                .status(400)
                .send({ status: false, message: "Product title is required" });
        }

        const notUniqueTitle = await ProductModel.findOne({ title: title });

        if (notUniqueTitle) {
            return res
                .status(400)
                .send({ status: false, message: "Product title already exist" });
        }

        if (!isValidInputValue(description)) {
            return res
                .status(400)
                .send({ status: false, message: "Product description is required" });
        }

        if (!isValidNumber(price) || !isValidPrice(price)) {
            return res
                .status(400)
                .send({ status: false, message: "Enter a valid product price" });
        }

        if (!isValidInputValue(currencyId) || getSymbolFromCurrency(currencyId) === undefined) {
            return res
                .status(400)
                .send({ status: false, message: "Enter a valid currencyId" });
        }

        //convert price to indian rupee
        if (currencyId !== "INR") {
            price = await Convert(Number(price)).from(currencyId).to("INR");
            price = Math.ceil(price)
            currencyId = "INR";
        }

        if (isFreeShipping) {
            if (["true", "false"].includes(isFreeShipping) === false) {
                return res
                    .status(400)
                    .send({ status: false, message: "isFreeShipping should be boolean" });
            }
        }

        if (style) {
            if (!isValidInputValue(style)) {
                return res
                    .status(400)
                    .send({ status: false, message: "product style should be in valid format" });
            }
        }

        if (!isValidInputValue(availableSizes)) {
            return res
                .status(400)
                .send({ status: false, message: "product available sizes are required " });
        }

        // parsing string 
        availableSizes = JSON.parse(availableSizes);

        // available sizes should be an array
        if (!Array.isArray(availableSizes) || availableSizes.length === 0) {
            return res
                .status(400)
                .send({ status: false, message: "enter available sizes in valid format : [X, M, L]" });
        }
        //validating each element of array
        for (let i = 0; i < availableSizes.length; i++) {
            const element = availableSizes[i];

            if (!["S", "XS", "M", "X", "L", "XXL", "XL"].includes(element)) {
                return res
                    .status(400)
                    .send({ status: false, message: `available sizes should be from:  [S, XS, M, X, L, XXL, XL]` });
            }
        }

        if (installments) {
            if (!isValidNumber(installments)) {
                return res
                    .status(400)
                    .send({ status: false, message: "should be in valid format and greater than or equal to zero" });
            }
        }

        if (!image || image.length === 0) {
            return res
                .status(400)
                .send({ status: false, message: "product image is required" });
        }

        // validating image type
        if (!isValidImageType(image[0].mimetype)) {
            return res
                .status(400)
                .send({ status: false, message: "Only images can be uploaded (jpeg/jpg/png)" });
        }

        // uploading image to AWS server and creating url
        const productImageUrl = await AWS.uploadFile(image[0]);

        const productData = {
            title: title.trim(),
            description: description.trim(),
            price: Number(price),
            currencyId: currencyId,
            currencyFormat: getSymbolFromCurrency(currencyId),
            isFreeShipping: isFreeShipping ? isFreeShipping : false,
            productImage: productImageUrl,
            style: style,
            availableSizes: availableSizes,
            installments: installments,
            deletedAt: null,
            isDeleted: false,
        };

        const newProduct = await ProductModel.create(productData);

        res
            .status(201)
            .send({ status: true, message: "new product added successfully", data: newProduct });

    } catch (error) {

        res.status(500).send({ error: error.message });

    }
};

//*************************************UPDATE A PRODUCT DETAILS********************************************** */

const updateProductDetails = async function(req, res) {
    try {
        const queryParams = req.query;
        const requestBody = req.body ;
        const productId = req.params.productId;
        const image = req.files;

        // no data is required from query params
        if (isValidInputBody(queryParams)) {
            return res
                .status(404)
                .send({ status: false, message: "Page not found" });
        }
        // checking product exist with product ID
        const productByProductId = await ProductModel.findOne({
            _id: productId,
            isDeleted: false,
            deletedAt: null,
        });

        if (!productByProductId) {
            return res
                .status(404)
                .send({ status: false, message: "No product found by product id" });
        }

        if (!isValidInputBody(requestBody) &&typeof image === undefined) {
            return res
                .status(400)
                .send({status: false,message: "Update related product data required"});
        }

        let {title,description,price,isFreeShipping,style,availableSizes,installments,} = requestBody;

        // creating an empty object 
        const updates = { $set: {} };


        // if request body has key name "title" then after validating its value, same is added to updates object
        if (title) {
            if (!isValidInputValue(title)) {
                return res
                    .status(400)
                    .send({ status: false, message: "Invalid title" });
            }

            const notUniqueTitle = await ProductModel.findOne({
                title: title,
            });

            if (notUniqueTitle) {
                return res
                    .status(400)
                    .send({ status: false, message: "Product title already exist" });
            }

            updates["$set"]["title"] = title.trim();
        }
        // if request body has key name "description" then after validating its value, same is added to updates object
        if (description) {
            if (!isValidInputValue(description)) {
                return res
                    .status(400)
                    .send({ status: false, message: "Invalid description" });
            }
            updates["$set"]["description"] = description.trim();
        }

        // if request body has key name "price" then after validating its value, same is added to updates object
        if (price) {
            if (!isValidPrice(price)) {
                return res
                    .status(400)
                    .send({ status: false, message: "Invalid price" });
            }
            updates["$set"]["price"] = price;
        }

        // if request body has key name "isFreeShipping" then after validating its value, same is added to updates object
        if (isFreeShipping) {
            if (["true", "false"].includes(isFreeShipping) === false) {
                return res
                    .status(400)
                    .send({ status: false, message: "isFreeShipping should be boolean" });
            }
            updates["$set"]["isFreeShipping"] = isFreeShipping;
        }

        // if request body has key name "style" then after validating its value, same is added to updates object
        if (style) {
            if (!isValidInputValue(style)) {
                return res
                    .status(400)
                    .send({ status: false, message: "Invalid style" });
            }
            updates["$set"]["style"] = style;
        }

        // if request body has key name "availableSizes" then after validating its value, same is added to updates object
        if (availableSizes) {
            
            if (!isValidInputValue(availableSizes)) {
                return res
                    .status(400)
                    .send({ status: false, message: "Invalid format of availableSizes" });
            }

            availableSizes = JSON.parse(availableSizes);

            if (Array.isArray(availableSizes) && availableSizes.length > 0) {
                for (let i = 0; i < availableSizes.length; i++) {
                    const element = availableSizes[i];

                    if (!["S", "XS", "M", "X", "L", "XXL", "XL"].includes(element)) {
                        return res
                            .status(400)
                            .send({status: false,message: `available sizes should be from:  S, XS, M, X, L, XXL, XL`});
                    }
                }

                updates["$set"]["availableSizes"] = availableSizes;
            } else {
                return res
                    .status(400)
                    .send({ status: false, message: "Invalid available Sizes" });
            }
        }

        // if request body has key name "installments" then after validating its value, same is added to updates object
        if (installments) {
            if (!isValidNumber(installments)) {
                return res
                    .status(400)
                    .send({ status: false, message: "invalid installments" });
            }
            updates["$set"]["installments"] = Number(installments);
        }

        // if request body has key name "image" then after validating its value, same is added to updates object
        if (typeof image !== undefined) {
            if (image && image.length > 0) {
                if (!isValidImageType(image[0].mimetype)) {
                    return res
                        .status(400)
                        .send({status: false,message: "Only images can be uploaded (jpeg/jpg/png)"});
                }

                const productImageUrl = await AWS.uploadFile(image[0]);
                updates["$set"]["productImage"] = productImageUrl;
            }
        }

        if (Object.keys(updates["$set"]).length === 0) {
            return res.json("nothing is updated");
        }

        // updating product data of given ID by passing updates object
        const updatedProduct = await ProductModel.findOneAndUpdate({ _id: productId },updates, { new: true });

        res
            .status(200)
            .send({status: true,message: "Product data updated successfully",data: updatedProduct});

    } catch (error) {

        res.status(500).send({ error: error.message });
        
    }
};


//**********************************EXPORTING PRODUCT RELATED HANDLER FUNCTION******************************* */

module.exports = {
    registerProduct,
    updateProductDetails
};