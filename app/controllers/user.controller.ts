import { MultiDbORM } from "multi-db-orm";
import { Utils } from "../utils/utils";
import { Callback, NPUser } from "../models";


export class NPUserController {
    db: MultiDbORM;
    tableName: string;
    constructor(db: MultiDbORM, tableName: string = 'npusers') {
        this.db = db;
        this.tableName = tableName;
    }

    async init() {
        const sample: NPUser = {
            id: "user_aB3dE9xY1Z",
            name: "tset",
            email: "testgmailcom",
            phone: "12345678",
        };
        this.db.create(this.tableName, sample);
    }

    async create(userData: NPUser): Promise<NPUser> {
        try {
            let user = await this.db.getOne(this.tableName, { email: userData.email })
            if (user) {
                const myquery = { email: userData.email };

                const objForUpdate: any = Object.assign({}, user);

                if (userData.email && userData.email.indexOf("@") !== -1) objForUpdate.email = userData.email;
                if (userData.phone && userData.phone.length > 2) objForUpdate.phone = userData.phone;
                if (userData.name && userData.name.length > 2) objForUpdate.name = userData.name;
                const newvalues = objForUpdate;

                try {
                    await this.db.update(this.tableName, myquery, newvalues);
                    return objForUpdate
                } catch (uErr: any) {
                    throw new Error(uErr.message || 'Some error occurred while updating users.');
                }

            } else {
                userData.id = "user_" + Utils.makeid();
                await this.db.insert(this.tableName, userData);
                return userData;
            }
        }
        catch (err: any) {
            throw new Error(err.message || 'Some error occurred while creating users.');
        }

    };

};
