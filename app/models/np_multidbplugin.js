class MultiDbMapper {

    objectData
    constructor(objectData) {
        MultiDbMapper.sanitizeRequest(objectData)
        this.objectData = objectData;
    }


    static async sanitizeRequest(body) {

        if (body.amount)
            body.amount = parseFloat(body.amount);
        if (body.TXN_AMOUNT)
            body.amount = parseFloat(body.TXN_AMOUNT);
    }

    async save() {

        var response = await MultiDbMapper.db.insert(MultiDbMapper.modelname, this.objectData);
        response = response.ops[0];
        MultiDbMapper.sanitizeRequest(response)

        return response;
    }

    //callback(err,resp)
    static async findOne(query, cb) {

        var response;
        try {
            response = await MultiDbMapper.db.getOne(MultiDbMapper.modelname, query);
            MultiDbMapper.sanitizeRequest(response)
        } catch (e) {
            if (cb)
                cb(e, undefined)
            else
                throw e;
        }
        if (cb)
            cb(undefined, response);
        else
            return response;
    }

    static async updateOne(query, newValue, cb) {

        var response;
        try {

            response = await MultiDbMapper.db.update(MultiDbMapper.modelname, query, newValue['$set']);

        } catch (e) {
            if (cb)
                cb(e, undefined)
            else
                throw e;
        }

        if (cb)
            cb(undefined, response);
        else
            return response;
    }

    static async deleteOne(query, cb) {

        var response;
        try {

            response = await MultiDbMapper.db.delete(MultiDbMapper.modelname, query);
            MultiDbMapper.sanitizeRequest(response)

        } catch (e) {
            if (cb)
                cb(e, undefined)
            else
                throw e;
        }
        if (cb)
            cb(undefined, response)
        else
            return response;

    }

}

module.exports = MultiDbMapper;
