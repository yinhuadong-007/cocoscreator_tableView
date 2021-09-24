import { Component, _decorator } from "cc";
import TableView from "./TableView";

const { ccclass, property } = _decorator;


@ccclass('TableViewCell')
export default class TableViewCell extends Component {
    static getSize(index: number, data?: any): number {
        return 0;
    }

    /**
     * 每组数据显示内容初始化
     * @param index 数据列表的第几组数据
     * @param data 数据的内容
     * @param tv tableView对象
     */
    init(index: number, data?: any, tv?: TableView) {
        
    }

    unInit() {
        
    }

    reload(data?: any) {
        
    }
}
