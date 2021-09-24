
import { _decorator, Component, Node } from 'cc';
import TableView from './TableView/TableView';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = MainScene
 * DateTime = Fri Mar 25 2022 23:52:01 GMT+0800 (中国标准时间)
 * Author = HANDCOCOS
 * FileBasename = MainScene.ts
 * FileBasenameNoExtension = MainScene
 * URL = db://assets/Script/MainScene.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/zh/
 *
 */
 
@ccclass('MainScene')
export class MainScene extends Component {
    @property({type: TableView})
    private hor_TableView: TableView;

    @property({type: TableView})
    private ver_TableView: TableView;

    start () {
        let data1: number[] = [];
        let data2: number[] = [];
        for(let i=0; i<30; i++){
            data1.push(i);
            data2.push(i);
        }
        this.hor_TableView.init(data1);


        this.ver_TableView.init(data1);
        this.ver_TableView.scrollToTargetIndex(10, 2);
    }

    onClickLeft(){
        this.hor_TableView.scrollToLastPage(0.2);
    }

    onClickRight(){
        this.hor_TableView.scrollToNextPage(0.2);
    }

}

