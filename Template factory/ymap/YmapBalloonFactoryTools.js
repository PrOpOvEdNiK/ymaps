import axios from "axios";
import qs from "qs";

import {waitMeSettings} from "../map";

export default class YmapBalloonFactoryTools {
    /**
     * Реализуем конструктор баллуна
     */
    static buildCallback = (context, ymaps) => {
        // Здесь весь объект объекта карты, на котором произошел клик
        const obObjectData = context.getData();
        const objectId = obObjectData['object']['id'];
        context.isCluster = obObjectData['object']['type'] === 'Cluster';

        context.constructor.superclass.build.call(context);
        this.defineNodes(context);

        // для баллунов кластера и объекта нужно разное поведение конструктора
        if (context.isCluster) {
            // Если в кластере много объектов, вместо того чтобы показывать его баллун, приблизим карту
            if (obObjectData['properties'].get('iconContent') > 5) {
                // Костыль, чтобы не отображался текущий баллун, пока он не закрылся
                // пока не понял как сделать, чтобы он не отображался вообще
                context.$balloon.css('opacity', 0);
                context.events.fire('userclose');

                // Т.к. geoQuery умеет работать только с объектами IGeoObject, ICollection либо специальным JSON`ом
                // а у нас есть только geoObjects objectManager`а, придется конвертировать
                let arTempPlacemarks = [];
                obObjectData.properties.get('geoObjects').map(item => {
                    arTempPlacemarks.push(new ymaps.Placemark(item['geometry']['coordinates'], {
                        iconContent: item['id']
                    }));
                });

                // Более прямого способа получить здесь экземпляр карты не нашел
                const mapInstance = obObjectData['collection'].getObjectManager().getMap();
                // Из объектов кластера создадим виртуальную группу точек
                // получим ее границы и применим их к настоящей карте
                mapInstance.setBounds(ymaps.geoQuery(arTempPlacemarks).getBounds(), {checkZoomRange: true});
            } else {
                // Если баллун кластера только что открылся сделаем активным первый элемент,
                // если это ререндер, то пробросим установленый индекс
                const activeObjectIndex = obObjectData['properties'].get('clusterObjectIndex') || 0;
                this.setClusterActiveItem(context, activeObjectIndex);
            }
        } else {
            // если пользователь открыл объект в первый раз, нужно загрузить его данные
            // иначе просто покажем баллун с уже имеющимися
            if (!obObjectData['properties'].get('bContent')) {
                this.loadObjectContent(context, objectId);
            }
        }

        this.correctBalloonPosition(context);
        this.attachHandlers(context);
    };

    /**
     * Перед тем как уничтожить баллун снимем все обработчики событий
     */
    static clearCallback = context => {
        this.deattachHandlers(context);
        context.constructor.superclass.clear.call(context);
    };

    /**
     * Запишем в контекст узлы DOM с которыми будем работать
     */
    static defineNodes = context => {
        context.$balloon = $('.rgmap__balloon', context.getParentElement());
        context.$balloonCloseButton = $('.rgmap__balloon__close', context.getParentElement());

        if (context.isCluster) {
            context.$clusterListItems = $('.rgmap__balloon__list__item');
        }
    };

    // Поправим позицию балуна, чтобы хвостик указывал на метку
    static correctBalloonPosition = context => {
        const balloonNode = context.$balloon[0];
        context.$balloon.css({
            left: -70,
            top: -(balloonNode.offsetHeight + 10)
        });
    };

    static attachHandlers = context => {
        // @see https://tech.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout-docpage/#event_detail__event-userclose
        context.$balloonCloseButton.on('click', () => context.events.fire('userclose'));

        // если объект - кластер, нужны дополнительные обработчики
        if (context.isCluster) {
            // выбор элемента в списке
            $(document).on('click', '.rgmap__balloon__list__item', function (event) {
                event.preventDefault();
                const activeObjectIndex = context.$clusterListItems.index(event.currentTarget);
                YmapBalloonFactoryTools.setClusterActiveItem(context, activeObjectIndex);
            });
        }
    };

    static deattachHandlers = context => {
        context.$balloonCloseButton.off('click');
        if (context.isCluster) {
            $(document).off('click', '.rgmap__balloon__list__item');
        }
    };

    /**
     * @returns {*|Number[][]|ymaps.IShape|li|li} Позиция открывшегося баллуна, чтобы сдвинуть карту.
     */
    static correctMapPan = (context, ymaps) => {
        if (!f.isExist(context.$balloon)) {
            return context.superclass.getShape.call(context);
        }
        const position = context.$balloon.position();
        const balloonNode = context.$balloon[0];
        return new ymaps.shape.Rectangle(new ymaps.geometry.pixel.Rectangle([
            [position.left, position.top], [
                position.left + balloonNode.offsetWidth,
                position.top + balloonNode.offsetHeight + 20
            ]
        ]));
    };

    /**
     * Загрузит данные объекта и установит их в баллун
     */
    static loadObjectContent = (context, objectId, objectIndex = null) => {
        context.$balloon.waitMe(waitMeSettings);
        axios.post('/ajax/ajax_map.php', qs.stringify({
            ACTION: 'GET_OBJECT_DATA',
            ID: objectId
        }))
            .then(response => {
                const result = response['data']['result'];
                const newObjectProperties = {
                    clusterObjectIndex: objectIndex,
                    cTitle: result['TITLE'],
                    bImage: result['IMAGE'] || '/upload/not_found/image.png',
                    bTitle: result['TITLE'],
                    bContent: result['CONTENT']
                };
                const obObjectData = context.getData();

                // Установим полученые значения глобально,
                // чтобы не ходить за ними еще раз если пользователь снова откроет этот объект
                const objectManager = obObjectData['collection'].getObjectManager();
                const OBJECT = objectManager.objects.getById(objectId);
                OBJECT['properties'] = newObjectProperties;

                // Установка через сеттер автоматически перерисует баллун.
                obObjectData['properties'].set(newObjectProperties);

                context.$balloon.waitMe('hide');
            });
    };

    /**
     * Обработчик переключения объектов в баллуне кластера
     */
    static setClusterActiveItem = (context, index) => {
        context.$clusterListItems.removeClass('active');
        $(context.$clusterListItems[index]).addClass('active');

        const obObjectData = context.getData();
        const arClusterGeoObjects = obObjectData['properties'].get('geoObjects');
        const activeObject = arClusterGeoObjects[index];

        if (!activeObject['properties']['bContent']) {
            this.loadObjectContent(context, activeObject['id'], index);
        } else {
            obObjectData['properties'].set(activeObject['properties']);
        }
    };
}
