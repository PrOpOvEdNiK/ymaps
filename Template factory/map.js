'use strict';

import axios from 'axios';
import qs from 'qs';

import MapBalloonFactory from './ymap/YmapBalloonFactory';

export const waitMeSettings = {
    effect: 'bounce',
    text: '',
    color: '#000',
    maxSize: '',
    waitTime: -1,
    textPos: 'vertical',
    fontSize: '',
    source: '',
    onClose: function () {
    }
};

const pointIconColorMap = {
    'hotels': 'rgb(0, 193, 158)',
    'places': 'rgb(99, 102, 206)'
};

export default class CMap {
    constructor() {
        this.obRGmap = {};
        this.objectManager = {};
        this.$map = $('#rgmap');

        this.init();
    }

    init() {
        console.log('init map');
        this.$map.waitMe(waitMeSettings);
    };

    onerror() {
        console.log('map onerror');
        alert("map onerror");
    };

    /**
     * Точка входа. Функция вызывается после загрузки АПИ карт.
     */
    onload(ymaps) {
        this.obRGmap = new ymaps.Map("rgmap", {
            center: [53.7, 87.1],
            zoom: 10,
            controls: ['smallMapDefaultSet']
        });

        // для оптимизаци работы с большим количеством объектов на карте
        // будем пользоваться ymaps.ObjectManager
        const clustererOptions = {
            // включим авто кластеризацию
            clusterize: true,
            // установим макет кластеров "круговая диаграмма
            clusterIconLayout: "default#pieChart",
            clusterIconPieChartRadius: 25,
            clusterIconPieChartCoreRadius: 15,
            clusterIconPieChartStrokeWidth: 4,
            // размер ячейки для кластеризации
            gridSize: 64,
            // включим открытие баллуна на кластерах
            clusterDisableClickZoom: true,
            // зададим кастомные шаблоны баллунов
            geoObjectBalloonLayout: MapBalloonFactory.getObjectBalloon(ymaps),
            clusterBalloonLayout: MapBalloonFactory.getClusterBalloon(ymaps),
            // отключим превращение баллунов в панель
            geoObjectBalloonPanelMaxMapArea: 0,
            clusterBalloonPanelMaxMapArea: 0,
            // запретим скрывать метки при открытии баллуна
            geoObjectHideIconOnBalloonOpen: false,
            clusterHideIconOnBalloonOpen: false
        };
        this.objectManager = new ymaps.ObjectManager(clustererOptions);
        this.obRGmap.geoObjects.add(this.objectManager);

        axios.post('/ajax/ajax_map.php', qs.stringify({
            ACTION: 'GET_MAP_DATA',
            PARAMS: this.$map.data('params')
        }))
            .then(response => {
                this.setMapObjects(response.data.result);
                this.obRGmap.setBounds(this.objectManager.getBounds(), {});
                this.$map.waitMe("hide");

                this.handlersInit(ymaps);
            });
    };

    setMapObjects(objects) {
        let mapData = [];
        objects.map(object => {
            let {ID, NAME, TYPE, COORDINATES} = object;
            if (COORDINATES) {
                const arCoordinates = COORDINATES.split(',');
                // @todo надо будет убрать
                if (TYPE === 'places') {
                    ID = Number(ID) + 100000;
                    arCoordinates[0] = Number(arCoordinates[0]) + (Math.random() * 0.1 - 0.05);
                    arCoordinates[1] = Number(arCoordinates[1]) + (Math.random() * 0.2 - 0.1);
                }
                const objectData = {
                    obType: TYPE,
                    type: 'Feature',
                    id: ID,
                    geometry: {
                        type: 'Point',
                        coordinates: [arCoordinates[0], arCoordinates[1]]
                    },
                    properties: {
                        cTitle: NAME,
                        // hintContent: NAME,
                        bImage: '',
                        bTitle: '',
                        bContent: ''
                    },
                    options: {
                        preset: 'islands#circleDotIcon',
                        iconColor: pointIconColorMap[TYPE]
                    }
                };
                mapData.push(objectData);
            }
        });
        this.objectManager.add(mapData);
    };

    filterHandler(e, node) {
        const $this = $(node);
        if (!$this.hasClass('checked') || $('.checked').length > 1) {
            $this.toggleClass('checked');

            let arActiveTypes = [];
            $('.checked').each((i, item) => {
                console.log(item.dataset['type']);
                arActiveTypes.push(item.dataset['type']);
            });
            this.objectManager.setFilter((object) => (arActiveTypes.includes(object['obType'])));
        }
    };

    hasBalloonData(objectId) {
        return !!this.objectManager.objects.getById(objectId).properties.balloonContent;
    }

    handlersInit(ymaps) {
        const mapInstance = this;
        const OM = mapInstance.objectManager;

        OM['clusters'].events.add('click', e => {
            const objectId = e.get('objectId');
            const CLUSTER = OM['clusters'].getById(objectId);
        });

        OM['objects'].events.add('click', e => {
            const objectId = e.get('objectId');
            const OBJECT = OM.objects.getById(objectId);
        });
    }
}