//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

interface DialogOutput {
    promiseId: number,
    cancelled: boolean
    fieldValues: { [key: string]: string }
}

interface DialogInput {
    promiseId: number,
    message: string,
    caption: string,
    inputFields: FieldDescription[]
}

interface FieldDescription {
    Name: string,
    Type: string,
    IsArray: boolean,
    IsSecureString: boolean
}
