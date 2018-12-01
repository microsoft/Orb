interface String {
    format(...replacements: (string | number | boolean)[]): string;
}

interface StringMap<V> {
    [K: string]: V;
}

// Adding to Node global namespace
declare module NodeJS {
    interface Global {
        linkData?: any,
        fileData?: any,
        filePath?: any,
        instanceId?: any,
        mainWindowHandle?: Buffer
    }
}

declare module '*.css' {
    interface IClassNames {
        [className: string]: string
    }
    const classNames: IClassNames;
    export = classNames;
}