const mongoose = require('mongoose');

const isTransactionUnsupported = (error) => {
    const message = error?.message || '';
    return (
        message.includes('Transaction numbers are only allowed on a replica set member or mongos')
        || message.includes('transactions are not supported')
        || error?.codeName === 'IllegalOperation'
    );
};

const runWithOptionalTransaction = async (work) => {
    const session = await mongoose.startSession();

    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } catch (error) {
        if (!isTransactionUnsupported(error)) {
            throw error;
        }

        return work(null);
    } finally {
        await session.endSession();
    }
};

module.exports = {
    runWithOptionalTransaction
};
