
import { _decorator, Component, Node, Label } from 'cc';
import TableView from './TableView/TableView';
import TableViewCell from './TableView/TableViewCell';
const { ccclass, property } = _decorator;
 
@ccclass('Src_Item_Ver')
export class Src_Item_Ver extends TableViewCell {
    @property({type:Label})
    private lab: Label;

    start () {
        // [3]
    }

    init(index: number, data?: any, tv?: TableView) {
        this.lab.string = data;
    }

    
}
